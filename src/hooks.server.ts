import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.requestId = event.request.headers.get('x-request-id')?.slice(0, 80) || crypto.randomUUID();
  const response = await resolve(event);
  const headers = response.headers;
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "media-src 'self' blob: https:",
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
    "font-src 'self' data:",
    "connect-src 'self' https: http://127.0.0.1:* ws: wss:"
  ];

  if (event.url.protocol === 'https:') csp.push('upgrade-insecure-requests');
  headers.set('Content-Security-Policy', csp.join('; '));
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  headers.set('X-Request-Id', event.locals.requestId);
  if (event.url.protocol === 'https:') {
    headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
};
