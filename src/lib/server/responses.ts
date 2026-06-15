import { json } from '@sveltejs/kit';
import type { CmsEnvelope, CmsErrorCode, CmsErrorEnvelope } from '$lib/contracts/cms';
import { CMS_CONTRACT_VERSION } from '$lib/contracts/cms';
import { CmsClientError } from './cms-client';
import { RequestSecurityError } from './request-security';
import { LocalAuthError } from './local-auth';
import { LocalCmsError } from './local-cms';

export function cmsOk<T>(data: T, requestId: string, status = 200) {
  const body: CmsEnvelope<T> = { ok: true, data, meta: { contractVersion: CMS_CONTRACT_VERSION, requestId } };
  return json(body, { status });
}

export function cmsFailure(error: unknown, requestId: string) {
  let status = 500;
  let code: CmsErrorCode = 'internal_error';
  let message = 'The builder request could not be completed.';
  if (error instanceof RequestSecurityError) {
    status = 403;
    code = 'csrf_invalid';
    message = 'Request security validation failed.';
  } else if (error instanceof LocalAuthError) {
    status = error.code === 'unauthorized' ? 401 : 403;
    code = error.code;
    message = error.code === 'unauthorized' ? 'Authentication is required.' : 'CMS permission is required.';
  } else if (error instanceof LocalCmsError) {
    status = error.status;
    code = error.code;
    message = error.message;
  } else if (error instanceof CmsClientError) {
    status = error.status;
    code = error.code;
    message = error.message;
  }
  const body: CmsErrorEnvelope = { ok: false, error: { code, message }, meta: { contractVersion: CMS_CONTRACT_VERSION, requestId } };
  return json(body, { status });
}
