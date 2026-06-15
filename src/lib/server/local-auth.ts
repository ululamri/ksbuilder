import { randomBytes } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { hashToken, localDb } from './local-db';

export const SESSION_COOKIE = 'spark_builder_session';

export type LocalUser = { id: string; email: string; displayName: string; roles: string[] };

export function createLocalSession(cookies: Cookies, userId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  localDb().prepare('delete from local_sessions where expires_at <= ?').run(new Date().toISOString());
  localDb().prepare('insert into local_sessions (token_hash, user_id, expires_at, created_at) values (?, ?, ?, ?)')
    .run(hashToken(token), userId, expiresAt.toISOString(), new Date().toISOString());
  cookies.set(SESSION_COOKIE, token, { path: '/', httpOnly: true, secure: !dev, sameSite: 'strict', expires: expiresAt });
}

export function clearLocalSession(cookies: Cookies) {
  const token = cookies.get(SESSION_COOKIE);
  if (token) localDb().prepare('delete from local_sessions where token_hash = ?').run(hashToken(token));
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function currentLocalUser(cookies: Cookies): LocalUser | null {
  const token = cookies.get(SESSION_COOKIE);
  if (!token) return null;
  const row = localDb().prepare(`select u.id, u.email, u.display_name, u.roles
    from local_sessions s join local_users u on u.id = s.user_id
    where s.token_hash = ? and s.expires_at > ?`).get(hashToken(token), new Date().toISOString()) as Record<string, string> | undefined;
  return row ? { id: row.id, email: row.email, displayName: row.display_name, roles: JSON.parse(row.roles) } : null;
}

export function requireLocalUser(cookies: Cookies): LocalUser {
  const user = currentLocalUser(cookies);
  if (!user) throw new LocalAuthError('unauthorized');
  return user;
}

export function requireLocalAdmin(cookies: Cookies): LocalUser {
  const user = requireLocalUser(cookies);
  if (!user.roles.includes('cms_admin')) throw new LocalAuthError('forbidden');
  return user;
}

export class LocalAuthError extends Error {
  constructor(public code: 'unauthorized' | 'forbidden') { super(code); }
}
