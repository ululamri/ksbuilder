import type { RequestHandler } from './$types';
import { normalizeProject } from '$lib/builder/persistence';
import { isBuilderExportTarget } from '$lib/server/project-export';
import { requireLocalUser } from '$lib/server/local-auth';
import { assertMutationRequest } from '$lib/server/request-security';
import { createProjectExport } from '$lib/server/project-export';
import { cmsFailure } from '$lib/server/responses';
import { CmsClientError } from '$lib/server/cms-client';

export const POST: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    requireLocalUser(event.cookies);
    const payload = await event.request.json() as { project?: unknown; target?: unknown } | unknown;
    const project = normalizeProject((payload && typeof payload === 'object' && 'project' in payload ? payload.project : payload) as never);
    if (!project) throw new CmsClientError(422, 'validation_failed', 'Project is invalid.');
    const target = payload && typeof payload === 'object' && 'target' in payload && isBuilderExportTarget(payload.target) ? payload.target : 'static-html';
    const artifact = createProjectExport(project, target);
    const body = artifact.body.buffer.slice(artifact.body.byteOffset, artifact.body.byteOffset + artifact.body.byteLength) as ArrayBuffer;
    return new Response(body, { headers: { 'content-type': artifact.contentType, 'content-disposition': `attachment; filename="${artifact.filename}"`, 'cache-control': 'no-store' } });
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};
