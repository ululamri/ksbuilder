import type { RequestHandler } from './$types';
import { normalizeCmsProjectRecord } from '$lib/contracts/cms';
import { builderConfig } from '$lib/server/config';
import { requireLocalUser } from '$lib/server/local-auth';
import { restoreLocalRevision } from '$lib/server/local-cms';
import { cmsRequest, CmsClientError } from '$lib/server/cms-client';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';

export const POST: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    const revision = Number(event.params.revision);
    const payload = await event.request.json() as { expectedRevision: number };
    if (!Number.isSafeInteger(revision) || revision < 1 || !Number.isSafeInteger(payload.expectedRevision)) throw new CmsClientError(422, 'validation_failed', 'Revision is invalid.');
    const data = builderConfig().mode === 'local'
      ? restoreLocalRevision(event.params.projectId, revision, payload.expectedRevision, requireLocalUser(event.cookies), event.locals.requestId)
      : normalizeCmsProjectRecord(await cmsRequest(event, `/v1/cms/projects/${encodeURIComponent(event.params.projectId)}/revisions/${revision}/restore`, {
          method: 'POST', headers: { 'content-type': 'application/json', 'if-match': String(payload.expectedRevision) }, body: '{}'
        }));
    if (!data) throw new CmsClientError(502, 'backend_unavailable', 'Invalid project payload.');
    return cmsOk(data, event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};
