import type { RequestHandler } from './$types';
import { requireLocalUser } from '$lib/server/local-auth';
import { hashPassword, localDb, verifyPassword } from '$lib/server/local-db';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';
import { CmsClientError } from '$lib/server/cms-client';

export const POST: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    const user = requireLocalUser(event.cookies);
    const payload = await event.request.json() as { currentPassword: string; newPassword: string };
    const row = localDb().prepare('select password_hash from local_users where id = ?').get(user.id) as { password_hash: string };
    if (!verifyPassword(payload.currentPassword ?? '', row.password_hash)) throw new CmsClientError(401, 'unauthorized', 'Current password is incorrect.');
    if (!payload.newPassword || payload.newPassword.length < 16 || payload.newPassword.length > 128) throw new CmsClientError(422, 'validation_failed', 'New password must contain 16 to 128 characters.');
    localDb().prepare('update local_users set password_hash = ? where id = ?').run(hashPassword(payload.newPassword), user.id);
    localDb().prepare('delete from local_sessions where user_id = ?').run(user.id);
    return cmsOk({ changed: true }, event.locals.requestId);
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};
