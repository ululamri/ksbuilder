import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { builderConfig } from './config';
import { audit, localDb } from './local-db';
import type { LocalUser } from './local-auth';
import { CmsClientError } from './cms-client';
import { MEDIA_POLICIES, validateMedia } from './media-policy';

type LocalMediaRow = {
  id: string;
  file_name: string;
  content_type: string;
  size: number;
  folder: string;
  storage_name: string;
  created_at: string;
  updated_at: string;
};

export type LocalMediaAsset = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  folder: string;
  createdAt: string;
  updatedAt: string;
  url: string;
};

export function listLocalMedia(user: LocalUser): LocalMediaAsset[] {
  const rows = localDb().prepare('select id, file_name, content_type, size, folder, storage_name, created_at, updated_at from local_media where owner_id = ? order by updated_at desc, created_at desc limit 500').all(user.id) as LocalMediaRow[];
  return rows.map(toAsset);
}

export async function createLocalMediaFromFile(file: File, user: LocalUser, requestId: string, folderInput: string | null = null): Promise<LocalMediaAsset> {
  if (!MEDIA_POLICIES[file.type]) throw new CmsClientError(422, 'validation_failed', 'Media type is not supported.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return createLocalMediaFromBuffer(file, bytes, user, requestId, folderInput);
}

function createLocalMediaFromBuffer(file: File, bytes: Uint8Array, user: LocalUser, requestId: string, folderInput: string | null): LocalMediaAsset {
  const policy = validateMedia(file.type, bytes);
  if (!policy) throw new CmsClientError(422, 'validation_failed', 'Media signature, structure, or file size is invalid.');
  const originalName = sanitizeMediaFileName(file.name);
  const folder = sanitizeMediaFolder(folderInput);
  const extension = policy.extension;
  const id = crypto.randomUUID();
  const storageName = `${id}${extension}`;
  const directory = join(builderConfig().dataDir, 'media');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(join(directory, storageName), bytes, { mode: 0o600 });
  const now = new Date().toISOString();
  localDb().prepare('insert into local_media (id, owner_id, file_name, content_type, size, folder, storage_name, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, user.id, originalName, file.type, file.size, folder, storageName, now, now);
  audit('media.create', requestId, user.id, null, null, { id, contentType: file.type, size: file.size, folder });
  return { id, fileName: originalName, contentType: file.type, size: file.size, folder, createdAt: now, updatedAt: now, url: `/api/builder/media/${id}` };
}

export function updateLocalMedia(assetId: string, user: LocalUser, requestId: string, input: { fileName?: string; folder?: string | null }): LocalMediaAsset {
  const row = localDb().prepare('select id, file_name, content_type, size, folder, storage_name, created_at, updated_at from local_media where id = ? and owner_id = ?').get(assetId, user.id) as LocalMediaRow | undefined;
  if (!row) throw new CmsClientError(404, 'not_found', 'Media was not found.');
  const fileName = input.fileName !== undefined ? sanitizeMediaFileName(input.fileName) : row.file_name;
  const folder = input.folder !== undefined ? sanitizeMediaFolder(input.folder) : row.folder;
  const updatedAt = new Date().toISOString();
  localDb().prepare('update local_media set file_name = ?, folder = ?, updated_at = ? where id = ? and owner_id = ?').run(fileName, folder, updatedAt, assetId, user.id);
  audit('media.update', requestId, user.id, null, null, { id: assetId, fileName, folder });
  return { id: row.id, fileName, contentType: row.content_type, size: Number(row.size), folder, createdAt: row.created_at, updatedAt, url: `/api/builder/media/${row.id}` };
}

export function deleteLocalMedia(assetId: string, user: LocalUser, requestId: string): void {
  const row = localDb().prepare('select id, storage_name from local_media where id = ? and owner_id = ?').get(assetId, user.id) as { id: string; storage_name: string } | undefined;
  if (!row) throw new CmsClientError(404, 'not_found', 'Media was not found.');
  if (mediaIsReferenced(assetId)) throw new CmsClientError(422, 'validation_failed', 'Media masih dipakai oleh proyek aktif atau situs yang sudah terbit.');
  localDb().prepare('delete from local_media where id = ? and owner_id = ?').run(assetId, user.id);
  try { unlinkSync(join(builderConfig().dataDir, 'media', row.storage_name)); } catch {}
  audit('media.delete', requestId, user.id, null, null, { id: assetId });
}

export function mediaPath(assetId: string, user: LocalUser): { path: string; contentType: string } {
  const row = localDb().prepare('select storage_name, content_type from local_media where id = ? and owner_id = ?').get(assetId, user.id) as { storage_name: string; content_type: string } | undefined;
  if (!row) throw new CmsClientError(404, 'not_found', 'Media was not found.');
  return { path: join(builderConfig().dataDir, 'media', row.storage_name), contentType: row.content_type };
}

function mediaIsReferenced(assetId: string): boolean {
  const marker = `/api/builder/media/${assetId}`;
  const row = localDb().prepare(`
    select 1
    from local_projects p
    join local_revisions current_r on current_r.project_id = p.id and current_r.revision = p.current_revision
    left join local_revisions published_r on published_r.project_id = p.id and published_r.revision = p.published_revision
    where instr(current_r.document, ?) > 0 or instr(coalesce(published_r.document, ''), ?) > 0
    limit 1
  `).get(marker, marker);
  return Boolean(row);
}

export function sanitizeMediaFileName(value: string): string {
  const cleaned = String(value || '').trim().replace(/[\\/\u0000-\u001f]+/g, '-').slice(0, 180);
  if (!cleaned) throw new CmsClientError(422, 'validation_failed', 'File name is required.');
  return cleaned;
}

export function sanitizeMediaFolder(value: string | null | undefined): string {
  if (!value) return '';
  const folder = String(value)
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
    .split('/')
    .map((segment) => segment.replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 5)
    .join('/');
  return folder.slice(0, 160);
}

function toAsset(row: LocalMediaRow): LocalMediaAsset {
  return {
    id: row.id,
    fileName: row.file_name,
    contentType: row.content_type,
    size: Number(row.size),
    folder: row.folder ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    url: `/api/builder/media/${row.id}`
  };
}
