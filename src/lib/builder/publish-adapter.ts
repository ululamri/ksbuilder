import type { CmsEnvelope, CmsErrorEnvelope, CmsSession, PublishProjectResult } from '$lib/contracts/cms';
import type { BuilderProject } from './types';

export type PublishResult = { ok: true; publishedAt: string } | { ok: false; message: string };

export interface PublishAdapter {
  publish(project: BuilderProject, revision?: number): Promise<PublishResult>;
}

export class DraftPublishAdapter implements PublishAdapter {
  async publish(): Promise<PublishResult> {
    await new Promise((resolve) => setTimeout(resolve, 650));
    return { ok: true, publishedAt: new Date().toISOString() };
  }
}

// Implement this adapter only after spark-api provides authenticated CMS RBAC endpoints.
export class SparkApiPublishAdapter implements PublishAdapter {
  async publish(project: BuilderProject, revision = 0): Promise<PublishResult> {
    const sessionResponse = await fetch('/api/builder/session', { credentials: 'same-origin' });
    const sessionBody = await sessionResponse.json() as CmsEnvelope<CmsSession> | CmsErrorEnvelope;
    if (!sessionBody.ok) return { ok: false, message: sessionBody.error.message };
    const response = await fetch(`/api/builder/projects/${encodeURIComponent(project.id)}/publish`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': sessionBody.data.csrfToken },
      body: JSON.stringify({ expectedRevision: revision })
    });
    const body = await response.json() as CmsEnvelope<PublishProjectResult> | CmsErrorEnvelope;
    if (!body.ok) return { ok: false, message: body.error.message };
    return { ok: true, publishedAt: body.data.publishedAt };
  }
}
