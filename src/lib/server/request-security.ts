import { dev } from '$app/environment';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { builderConfig } from './config';

export const CSRF_COOKIE = 'spark_builder_csrf';

export function ensureCsrfToken(cookies: Cookies): string {
  const current = cookies.get(CSRF_COOKIE);
  if (current && /^[a-f0-9]{64}$/.test(current)) return current;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  cookies.set(CSRF_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: !dev,
    sameSite: 'strict',
    maxAge: 60 * 60 * 8
  });
  return token;
}

export function assertMutationRequest(event: RequestEvent): void {
  const config = builderConfig();
  const origin = event.request.headers.get('origin');
  const cookieToken = event.cookies.get(CSRF_COOKIE);
  const headerToken = event.request.headers.get('x-csrf-token');
  const trustedOrigin = origin === config.allowedOrigin || (dev && origin === event.url.origin);
  if (!trustedOrigin || !cookieToken || cookieToken !== headerToken) {
    throw new RequestSecurityError();
  }
}

export class RequestSecurityError extends Error {}
