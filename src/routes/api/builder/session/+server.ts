import type { RequestHandler } from './$types';
import type { CmsSession } from '$lib/contracts/cms';
import { builderConfig } from '$lib/server/config';
import { cmsRequest } from '$lib/server/cms-client';
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
    const auth = await cmsRequest<{ user: { id: string; email: string; display_name: string; roles?: string[] } }>(event, '/v1/auth/me');
    return cmsOk<CmsSession>({
      backendMode: 'spark-api', authenticated: true,
      csrfToken,
      user: { id: auth.user.id, email: auth.user.email, displayName: auth.user.display_name, roles: auth.user.roles ?? [] }
    }, event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};
