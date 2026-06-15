import type { BuilderProject } from '$lib/builder/types';
import type { CmsProjectRecord, PublishProjectResult } from '$lib/contracts/cms';
import { audit, contentHash, localDb } from './local-db';
import type { LocalUser } from './local-auth';

export class LocalCmsError extends Error {
  constructor(public status: number, public code: 'not_found' | 'revision_conflict' | 'validation_failed', message: string) { super(message); }
}

type ProjectRow = { id: string; name: string; current_revision: number; published_revision: number | null; updated_at: string };
type RevisionRow = { revision: number; document: string; created_at: string; created_by: string; email?: string };

export function getLocalProject(projectId: string, user: LocalUser, requestId: string): CmsProjectRecord {
  const project = localDb().prepare('select id, name, current_revision, published_revision, updated_at from local_projects where id = ?').get(projectId) as ProjectRow | undefined;
  if (!project) throw new LocalCmsError(404, 'not_found', 'Project was not found.');
  const revision = localDb().prepare('select document from local_revisions where project_id = ? and revision = ?').get(projectId, project.current_revision) as { document: string };
  audit('project.read', requestId, user.id, projectId, project.current_revision);
  return { project: JSON.parse(revision.document), revision: project.current_revision, publishedRevision: project.published_revision, updatedAt: project.updated_at };
}

export function saveLocalProject(project: BuilderProject, expectedRevision: number, user: LocalUser, requestId: string): CmsProjectRecord {
  const db = localDb();
  const now = new Date().toISOString();
  const document = JSON.stringify(project);
  db.exec('begin immediate');
  try {
    const current = db.prepare('select current_revision, published_revision, created_at from local_projects where id = ?').get(project.id) as { current_revision: number; published_revision: number | null; created_at: string } | undefined;
    if (current && current.current_revision !== expectedRevision) throw new LocalCmsError(409, 'revision_conflict', 'A newer project revision is available.');
    if (!current && expectedRevision !== 0) throw new LocalCmsError(409, 'revision_conflict', 'Project does not exist at the expected revision.');
    const nextRevision = (current?.current_revision ?? 0) + 1;
    if (!current) {
      db.prepare('insert into local_projects (id, name, current_revision, published_revision, created_by, updated_by, created_at, updated_at) values (?, ?, ?, null, ?, ?, ?, ?)')
        .run(project.id, project.name, nextRevision, user.id, user.id, now, now);
    } else {
      db.prepare('update local_projects set name = ?, current_revision = ?, updated_by = ?, updated_at = ? where id = ?')
        .run(project.name, nextRevision, user.id, now, project.id);
    }
    db.prepare('insert into local_revisions (project_id, revision, document, content_hash, created_by, created_at) values (?, ?, ?, ?, ?, ?)')
      .run(project.id, nextRevision, document, contentHash(document), user.id, now);
    audit('project.save', requestId, user.id, project.id, nextRevision);
    db.exec('commit');
    return { project, revision: nextRevision, publishedRevision: current?.published_revision ?? null, updatedAt: now };
  } catch (error) {
    db.exec('rollback');
    throw error;
  }
}

export function publishLocalProject(projectId: string, expectedRevision: number, user: LocalUser, requestId: string): PublishProjectResult {
  const db = localDb();
  const current = db.prepare('select current_revision from local_projects where id = ?').get(projectId) as { current_revision: number } | undefined;
  if (!current) throw new LocalCmsError(404, 'not_found', 'Project was not found.');
  if (current.current_revision !== expectedRevision) throw new LocalCmsError(409, 'revision_conflict', 'Publish revision is stale.');
  const publishedAt = new Date().toISOString();
  db.prepare('update local_projects set published_revision = ?, updated_by = ?, updated_at = ? where id = ?').run(expectedRevision, user.id, publishedAt, projectId);
  audit('project.publish', requestId, user.id, projectId, expectedRevision);
  return { revision: expectedRevision, publishedAt, publicUrl: `/site/${projectId}` };
}

export function listLocalRevisions(projectId: string, user: LocalUser, requestId: string) {
  const rows = localDb().prepare(`select r.revision, r.created_at, r.content_hash, u.email
    from local_revisions r join local_users u on u.id = r.created_by
    where r.project_id = ? order by r.revision desc limit 100`).all(projectId) as Array<Record<string, string | number>>;
  audit('revision.list', requestId, user.id, projectId, null);
  return rows.map((row) => ({ revision: Number(row.revision), createdAt: String(row.created_at), contentHash: String(row.content_hash), createdBy: String(row.email) }));
}

export function restoreLocalRevision(projectId: string, revision: number, expectedRevision: number, user: LocalUser, requestId: string): CmsProjectRecord {
  const source = localDb().prepare('select document from local_revisions where project_id = ? and revision = ?').get(projectId, revision) as RevisionRow | undefined;
  if (!source) throw new LocalCmsError(404, 'not_found', 'Revision was not found.');
  const project = JSON.parse(source.document) as BuilderProject;
  const result = saveLocalProject(project, expectedRevision, user, requestId);
  audit('project.restore', requestId, user.id, projectId, result.revision, { sourceRevision: revision });
  return result;
}

export function getPublishedProject(projectId: string): BuilderProject {
  const row = localDb().prepare(`select r.document from local_projects p join local_revisions r
    on r.project_id = p.id and r.revision = p.published_revision where p.id = ? and p.published_revision is not null`).get(projectId) as { document: string } | undefined;
  if (!row) throw new LocalCmsError(404, 'not_found', 'Published site was not found.');
  return JSON.parse(row.document) as BuilderProject;
}

export function publishedProjectUsesMedia(assetId: string): boolean {
  const marker = `/api/builder/media/${assetId}`;
  const row = localDb().prepare(`select 1 from local_projects p join local_revisions r
    on r.project_id = p.id and r.revision = p.published_revision where instr(r.document, ?) > 0 limit 1`).get(marker);
  return Boolean(row);
}
