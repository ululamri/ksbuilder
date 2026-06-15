import { join } from 'node:path';
import type { RequestHandler } from './$types';
import { builderConfig } from '$lib/server/config';
import { requireLocalUser } from '$lib/server/local-auth';
import { localDb } from '$lib/server/local-db';
import { cmsFailure } from '$lib/server/responses';
import { CmsClientError } from '$lib/server/cms-client';
import { mediaResponse } from '$lib/server/media-response';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireLocalUser(event.cookies);
    const row = localDb().prepare('select storage_name, content_type from local_media where id = ? and owner_id = ?').get(event.params.assetId, user.id) as { storage_name: string; content_type: string } | undefined;
    if (!row) throw new CmsClientError(404, 'not_found', 'Media was not found.');
    return mediaResponse(join(builderConfig().dataDir, 'media', row.storage_name), row.content_type, event.request.headers.get('range'), 'private, max-age=3600');
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};
