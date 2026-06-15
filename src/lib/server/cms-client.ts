import type { RequestEvent } from '@sveltejs/kit';
import type { CmsErrorCode } from '$lib/contracts/cms';
import { builderConfig } from './config';

export class CmsClientError extends Error {
  constructor(public status: number, public code: CmsErrorCode, message: string) {
    super(message);
  }
}

function mapStatus(status: number): CmsErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'revision_conflict';
  if (status === 422 || status === 400) return 'validation_failed';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'backend_unavailable';
  return 'internal_error';
}

export async function cmsRequest<T>(event: RequestEvent, path: string, init: RequestInit = {}): Promise<T> {
  const config = builderConfig();
  if (config.mode !== 'spark-api') {
    throw new CmsClientError(503, 'backend_unavailable', 'CMS backend mode is not enabled.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  headers.set('x-cms-contract-version', '2026-06-13');
  headers.set('x-request-id', event.locals.requestId);
  const cookie = event.request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  try {
    const response = await event.fetch(`${config.apiUrl}${path}`, { ...init, headers, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new CmsClientError(response.status, mapStatus(response.status), body?.error?.message ?? 'CMS request failed.');
    }
    return body?.data ?? body;
  } catch (error) {
    if (error instanceof CmsClientError) throw error;
    throw new CmsClientError(503, 'backend_unavailable', 'CMS backend is unavailable.');
  } finally {
    clearTimeout(timeout);
  }
}
