import type { RequestHandler } from './$types';
import { clearLocalSession } from '$lib/server/local-auth';
import { assertMutationRequest } from '$lib/server/request-security';
import { cmsFailure, cmsOk } from '$lib/server/responses';

export const POST: RequestHandler = async (event) => {
  try {
    assertMutationRequest(event);
    clearLocalSession(event.cookies);
    return cmsOk({ loggedOut: true }, event.locals.requestId);
  } catch (error) {
    return cmsFailure(error, event.locals.requestId);
  }
};
