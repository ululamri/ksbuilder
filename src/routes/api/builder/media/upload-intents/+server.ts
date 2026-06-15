import type { RequestHandler } from './$types';
import { cmsRequest, CmsClientError } from '$lib/server/cms-client';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';
import { MEDIA_POLICIES } from '$lib/server/media-policy';

type UploadIntent = {
  assetId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
};

export const POST: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    const payload = await event.request.json() as { fileName: string; contentType: string; size: number };
    const policy = MEDIA_POLICIES[payload.contentType];
    if (!payload.fileName || payload.fileName.length > 180 || !policy || !Number.isSafeInteger(payload.size) || payload.size < 1 || payload.size > policy.maxSize) {
      throw new CmsClientError(422, 'validation_failed', 'Media metadata is invalid.');
    }
    const data = await cmsRequest<UploadIntent>(event, '/v1/cms/media/upload-intents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return cmsOk(data, event.locals.requestId, 201);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};
