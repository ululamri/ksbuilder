import type { RequestHandler } from './$types';
import { requireLocalUser } from '$lib/server/local-auth';
import { localDb } from '$lib/server/local-db';
import { cmsFailure, cmsOk } from '$lib/server/responses';

export const GET: RequestHandler = (event) => {
  try {
    requireLocalUser(event.cookies);
    const rows = localDb().prepare('select id, project_id, page_id, form_id, payload, created_at from local_form_submissions order by created_at desc limit 200').all() as Array<Record<string, string>>;
    return cmsOk(rows.map((row) => ({ id: row.id, projectId: row.project_id, pageId: row.page_id, formId: row.form_id, payload: JSON.parse(row.payload), createdAt: row.created_at })), event.locals.requestId);
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};
