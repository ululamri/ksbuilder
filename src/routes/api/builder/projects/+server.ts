import type { RequestHandler } from './$types';
import { builderConfig } from '$lib/server/config';
import { requireLocalUser } from '$lib/server/local-auth';
import { localDb } from '$lib/server/local-db';
import { cmsRequest } from '$lib/server/cms-client';
import { cmsFailure, cmsOk } from '$lib/server/responses';

export const GET: RequestHandler = async (event) => {
  try {
    if (builderConfig().mode === 'local') {
      requireLocalUser(event.cookies);
      const rows = localDb().prepare('select id, name, current_revision, published_revision, updated_at from local_projects order by updated_at desc limit 100').all() as Array<Record<string, string | number | null>>;
      return cmsOk(rows.map((row) => ({ id: row.id, name: row.name, revision: Number(row.current_revision), publishedRevision: row.published_revision === null ? null : Number(row.published_revision), updatedAt: row.updated_at })), event.locals.requestId);
    }
    return cmsOk(await cmsRequest(event, '/v1/cms/projects'), event.locals.requestId);
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};
