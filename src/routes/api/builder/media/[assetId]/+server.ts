import type { RequestHandler } from './$types';
import { requireLocalUser } from '$lib/server/local-auth';
import { cmsFailure } from '$lib/server/responses';
import { mediaResponse } from '$lib/server/media-response';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsOk } from '$lib/server/responses';
import { deleteLocalMedia, mediaPath, updateLocalMedia } from '$lib/server/local-media';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireLocalUser(event.cookies);
    const row = mediaPath(event.params.assetId, user);
    return mediaResponse(row.path, row.contentType, event.request.headers.get('range'), 'private, max-age=3600');
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};

export const PUT: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    const user = requireLocalUser(event.cookies);
    const payload = await event.request.json() as { fileName?: unknown; folder?: unknown };
    return cmsOk(updateLocalMedia(event.params.assetId, user, event.locals.requestId, {
      fileName: typeof payload.fileName === 'string' ? payload.fileName : undefined,
      folder: typeof payload.folder === 'string' ? payload.folder : payload.folder === null ? null : undefined
    }), event.locals.requestId);
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};

export const DELETE: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    const user = requireLocalUser(event.cookies);
    deleteLocalMedia(event.params.assetId, user, event.locals.requestId);
    return new Response(null, { status: 204 });
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};
