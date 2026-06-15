import type { RequestHandler } from './$types';
import { builderConfig } from '$lib/server/config';
import { createLocalSession } from '$lib/server/local-auth';
import { audit, localDb, verifyPassword } from '$lib/server/local-db';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';
import { CmsClientError } from '$lib/server/cms-client';

const loginAttempts = new Map<string, number[]>();

export const POST: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    const ip = event.getClientAddress();
    const now = Date.now();
    const recent = (loginAttempts.get(ip) ?? []).filter((time) => now - time < 15 * 60_000);
    if (recent.length >= 10) throw new CmsClientError(429, 'rate_limited', 'Too many login attempts. Try again later.');
    recent.push(now); loginAttempts.set(ip, recent);
    if (builderConfig().mode !== 'local') throw new CmsClientError(422, 'validation_failed', 'Local login is disabled.');
    const payload = await event.request.json() as { email: string; password: string };
    const row = localDb().prepare('select id, email, display_name, password_hash, roles from local_users where email = ?').get(payload.email?.toLowerCase()) as Record<string, string> | undefined;
    if (!row || !verifyPassword(payload.password ?? '', row.password_hash)) throw new CmsClientError(401, 'unauthorized', 'Email or password is incorrect.');
    createLocalSession(event.cookies, row.id);
    loginAttempts.delete(ip);
    audit('auth.login', event.locals.requestId, row.id, null, null);
    return cmsOk({ user: { id: row.id, email: row.email, displayName: row.display_name, roles: JSON.parse(row.roles) } }, event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};
