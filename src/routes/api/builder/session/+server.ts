import type { RequestHandler } from './$types';
import type { CmsSession } from '$lib/contracts/cms';
import { normalizeCmsAuthMe } from '$lib/contracts/cms';
import { builderConfig } from '$lib/server/config';
import { cmsRequest, CmsClientError } from '$lib/server/cms-client';
import { ensureCsrfToken } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';
import { currentLocalUser } from '$lib/server/local-auth';

export const GET: RequestHandler = async (event) => {
  const csrfToken = ensureCsrfToken(event.cookies);
  const config = builderConfig();
  if (config.mode === 'local') {
    const user = currentLocalUser(event.cookies);
    return cmsOk<CmsSession>({ backendMode: 'local', authenticated: Boolean(user), csrfToken, user: user ?? undefined }, event.locals.requestId);
  }
  if (config.mode === 'draft') {
    return cmsOk<CmsSession>({ backendMode: 'draft', authenticated: false, csrfToken }, event.locals.requestId);
  }
  try {
    const auth = normalizeCmsAuthMe(await cmsRequest(event, '/v1/auth/me'));
    if (!auth) throw new CmsClientError(502, 'backend_unavailable', 'Invalid auth payload.');
    return cmsOk<CmsSession>({
      backendMode: 'spark-api', authenticated: true,
      csrfToken,
      user: auth.user
    }, event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};
