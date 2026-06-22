import type { RequestHandler } from './$types';
import { builderConfig } from '$lib/server/config';
import { requireLocalUser } from '$lib/server/local-auth';
import { listLocalRevisions } from '$lib/server/local-cms';
import { cmsRequest, CmsClientError } from '$lib/server/cms-client';
import { cmsFailure, cmsOk } from '$lib/server/responses';
import { normalizeCmsRevisionList } from '$lib/contracts/cms';

export const GET: RequestHandler = async (event) => {
  try {
    const data = builderConfig().mode === 'local'
      ? listLocalRevisions(event.params.projectId, requireLocalUser(event.cookies), event.locals.requestId)
      : normalizeCmsRevisionList(await cmsRequest(event, `/v1/cms/projects/${encodeURIComponent(event.params.projectId)}/revisions`));
    if (!data) throw new CmsClientError(502, 'backend_unavailable', 'Invalid revisions payload.');
    return cmsOk(data, event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};
