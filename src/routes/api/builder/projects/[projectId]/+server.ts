import type { RequestHandler } from './$types';
import type { CmsProjectRecord, SaveProjectRequest } from '$lib/contracts/cms';
import { normalizeProject } from '$lib/builder/persistence';
import { cmsRequest, CmsClientError } from '$lib/server/cms-client';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';
import { builderConfig } from '$lib/server/config';
import { requireLocalUser } from '$lib/server/local-auth';
import { getLocalProject, saveLocalProject } from '$lib/server/local-cms';

export const GET: RequestHandler = async (event) => {
  try {
    if (builderConfig().mode === 'local') {
      return cmsOk(getLocalProject(event.params.projectId, requireLocalUser(event.cookies), event.locals.requestId), event.locals.requestId);
    }
    const data = await cmsRequest<CmsProjectRecord>(event, `/v1/cms/projects/${encodeURIComponent(event.params.projectId)}`);
    return cmsOk(data, event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};

export const PUT: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    const payload = await event.request.json() as SaveProjectRequest;
    const project = normalizeProject(payload.project);
    if (!project || project.id !== event.params.projectId || !Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0) {
      throw new CmsClientError(422, 'validation_failed', 'Project payload is invalid.');
    }
    if (builderConfig().mode === 'local') {
      return cmsOk(saveLocalProject(project, payload.expectedRevision, requireLocalUser(event.cookies), event.locals.requestId), event.locals.requestId);
    }
    const data = await cmsRequest<CmsProjectRecord>(event, `/v1/cms/projects/${encodeURIComponent(event.params.projectId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'if-match': String(payload.expectedRevision) },
      body: JSON.stringify({ project })
    });
    return cmsOk(data, event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};
