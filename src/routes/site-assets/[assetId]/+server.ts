import { join } from 'node:path';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { builderConfig } from '$lib/server/config';
import { localDb } from '$lib/server/local-db';
import { publishedProjectUsesMedia } from '$lib/server/local-cms';
import { mediaResponse } from '$lib/server/media-response';

export const GET: RequestHandler = ({ params, request }) => {
  if (!publishedProjectUsesMedia(params.assetId)) error(404, 'Asset not found');
  const row = localDb().prepare('select storage_name, content_type from local_media where id = ?').get(params.assetId) as { storage_name: string; content_type: string } | undefined;
  if (!row) error(404, 'Asset not found');
  return mediaResponse(join(builderConfig().dataDir, 'media', row.storage_name), row.content_type, request.headers.get('range'), 'public, max-age=31536000, immutable');
};
