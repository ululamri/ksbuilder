import type { RequestHandler } from './$types';
import { builderConfig } from '$lib/server/config';
import { requireLocalUser } from '$lib/server/local-auth';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';
import { CmsClientError } from '$lib/server/cms-client';
import { createLocalMediaFromFile, listLocalMedia } from '$lib/server/local-media';

export const GET: RequestHandler = async (event) => {
  try {
    const user = requireLocalUser(event.cookies);
    return cmsOk(listLocalMedia(user), event.locals.requestId);
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};

export const POST: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    if (builderConfig().mode !== 'local') throw new CmsClientError(422, 'validation_failed', 'Direct local upload is disabled.');
    const user = requireLocalUser(event.cookies);
    const form = await event.request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new CmsClientError(422, 'validation_failed', 'Media type is not supported.');
    const folder = typeof form.get('folder') === 'string' ? String(form.get('folder')) : null;
    const parentAssetId = typeof form.get('parentAssetId') === 'string' ? String(form.get('parentAssetId')) : null;
    const variantRole = typeof form.get('variantRole') === 'string' ? String(form.get('variantRole')) : null;
    const variantWidth = typeof form.get('variantWidth') === 'string' ? Number(form.get('variantWidth')) : null;
    const focalX = typeof form.get('focalX') === 'string' ? Number(form.get('focalX')) : null;
    const focalY = typeof form.get('focalY') === 'string' ? Number(form.get('focalY')) : null;
    return cmsOk(await createLocalMediaFromFile(file, user, event.locals.requestId, {
      folder,
      parentAssetId,
      variantRole,
      variantWidth,
      focalX,
      focalY
    }), event.locals.requestId, 201);
  } catch (error) { return cmsFailure(error, event.locals.requestId); }
};
