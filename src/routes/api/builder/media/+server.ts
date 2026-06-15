import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RequestHandler } from './$types';
import { builderConfig } from '$lib/server/config';
import { requireLocalUser } from '$lib/server/local-auth';
import { audit, localDb } from '$lib/server/local-db';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';
import { CmsClientError } from '$lib/server/cms-client';
import { MEDIA_POLICIES, validateMedia } from '$lib/server/media-policy';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireLocalUser(event.cookies);
    const rows = localDb().prepare('select id, file_name, content_type, size, created_at from local_media where owner_id = ? order by created_at desc limit 200').all(user.id) as Array<Record<string, string | number>>;
    return cmsOk(rows.map((row) => ({ id: row.id, fileName: row.file_name, contentType: row.content_type, size: row.size, createdAt: row.created_at, url: `/api/builder/media/${row.id}` })), event.locals.requestId);
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};

export const POST: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    if (builderConfig().mode !== 'local') throw new CmsClientError(422, 'validation_failed', 'Direct local upload is disabled.');
    const user = requireLocalUser(event.cookies);
    const form = await event.request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !MEDIA_POLICIES[file.type]) throw new CmsClientError(422, 'validation_failed', 'Media type is not supported.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const policy = validateMedia(file.type, bytes);
    if (!policy) throw new CmsClientError(422, 'validation_failed', 'Media signature, structure, or file size is invalid.');
    const originalName = file.name.slice(0, 180);
    const extension = policy.extension;
    const id = crypto.randomUUID();
    const storageName = `${id}${extension}`;
    const directory = join(builderConfig().dataDir, 'media');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(join(directory, storageName), bytes, { mode: 0o600 });
    const now = new Date().toISOString();
    localDb().prepare('insert into local_media (id, owner_id, file_name, content_type, size, storage_name, created_at) values (?, ?, ?, ?, ?, ?, ?)')
      .run(id, user.id, originalName, file.type, file.size, storageName, now);
    audit('media.create', event.locals.requestId, user.id, null, null, { id, contentType: file.type, size: file.size });
    return cmsOk({ id, fileName: originalName, contentType: file.type, kind: policy.kind, size: file.size, createdAt: now, url: `/api/builder/media/${id}` }, event.locals.requestId, 201);
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};
