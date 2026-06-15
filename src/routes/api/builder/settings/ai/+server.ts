import type { RequestHandler } from './$types';
import { builderConfig } from '$lib/server/config';
import { requireLocalAdmin } from '$lib/server/local-auth';
import { getLocalAiSettingsStatus, saveLocalAiSettings } from '$lib/server/local-ai-settings';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';
import { CmsClientError } from '$lib/server/cms-client';

export const GET: RequestHandler = async (event) => {
  try {
    if (builderConfig().mode !== 'local') throw new CmsClientError(503, 'backend_unavailable', 'AI settings are only available in local builder mode.');
    requireLocalAdmin(event.cookies);
    return cmsOk(getLocalAiSettingsStatus(), event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};

export const PUT: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    if (builderConfig().mode !== 'local') throw new CmsClientError(503, 'backend_unavailable', 'AI settings are only available in local builder mode.');
    const user = requireLocalAdmin(event.cookies);
    const payload = await event.request.json() as { provider: 'openai' | 'anthropic' | 'gemini' | 'custom'; apiKey?: string; model: string; apiBaseUrl: string };
    const normalized = saveLocalAiSettings({
      provider: payload.provider,
      apiKey: payload.apiKey === undefined ? undefined : payload.apiKey?.trim() ?? '',
      model: payload.model,
      apiBaseUrl: payload.apiBaseUrl
    }, user);
    return cmsOk(normalized, event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};
