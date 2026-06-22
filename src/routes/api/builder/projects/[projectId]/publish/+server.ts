import type { RequestHandler } from './$types';
import type { PublishProjectRequest, PublishProjectResult } from '$lib/contracts/cms';
import { normalizePublishProjectResult } from '$lib/contracts/cms';
import { builderConfig } from '$lib/server/config';
import { cmsRequest, CmsClientError } from '$lib/server/cms-client';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';
import { requireLocalUser } from '$lib/server/local-auth';
import { publishLocalProject } from '$lib/server/local-cms';

export const POST: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    const payload = await event.request.json() as PublishProjectRequest;
    if (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0) {
      throw new CmsClientError(422, 'validation_failed', 'Expected revision is invalid.');
    }
    if (builderConfig().mode === 'local') {
      return cmsOk(publishLocalProject(event.params.projectId, payload.expectedRevision, requireLocalUser(event.cookies), event.locals.requestId), event.locals.requestId);
    }
    if (builderConfig().mode === 'draft') {
      return cmsOk<PublishProjectResult>({ revision: payload.expectedRevision, publishedAt: new Date().toISOString(), publicUrl: null }, event.locals.requestId);
    }
    const data = normalizePublishProjectResult(await cmsRequest(event, `/v1/cms/projects/${encodeURIComponent(event.params.projectId)}/publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'if-match': String(payload.expectedRevision) },
      body: JSON.stringify({})
    }));
    if (!data) throw new CmsClientError(502, 'backend_unavailable', 'Invalid publish payload.');
    return cmsOk(data, event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};
