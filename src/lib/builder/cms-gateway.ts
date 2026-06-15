import type { BuilderExportTarget, BuilderProject } from './types';
import type { BuilderAiSettingsStatus, BuilderAiSettingsUpdateRequest, CmsEnvelope, CmsErrorEnvelope, CmsProjectRecord, CmsSession } from '$lib/contracts/cms';

export type BuilderMediaVariant = {
  id: string;
  contentType: string;
  size: number;
  width: number;
  variantRole: string;
  url: string;
};

export type BuilderMediaAsset = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  folder: string;
  focalX: number;
  focalY: number;
  createdAt: string;
  updatedAt: string;
  url: string;
  variants: BuilderMediaVariant[];
};

export class BuilderGatewayError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function envelope<T>(response: Response): Promise<T> {
  const body = await response.json() as CmsEnvelope<T> | CmsErrorEnvelope;
  if (!body.ok) throw new BuilderGatewayError(body.error.code, body.error.message);
  return body.data;
}

export class BuilderCmsGateway {
  private csrfToken: string | null = null;

  async session(): Promise<CmsSession> {
    const session = await envelope<CmsSession>(await fetch('/api/builder/session', { credentials: 'same-origin' }));
    this.csrfToken = session.csrfToken;
    return session;
  }

  async login(email: string, password: string): Promise<CmsSession> {
    const csrfToken = this.csrfToken ?? (await this.session()).csrfToken;
    await envelope(await fetch('/api/builder/auth/login', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ email, password })
    }));
    return this.session();
  }

  async logout(): Promise<void> {
    const csrfToken = this.csrfToken ?? (await this.session()).csrfToken;
    await envelope(await fetch('/api/builder/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'x-csrf-token': csrfToken } }));
    this.csrfToken = null;
  }

  async load(projectId: string): Promise<CmsProjectRecord> {
    return envelope(await fetch(`/api/builder/projects/${encodeURIComponent(projectId)}`, { credentials: 'same-origin' }));
  }

  async projects(): Promise<Array<{ id: string; name: string; revision: number; publishedRevision: number | null; updatedAt: string }>> {
    return envelope(await fetch('/api/builder/projects', { credentials: 'same-origin' }));
  }

  async save(project: BuilderProject, expectedRevision: number): Promise<CmsProjectRecord> {
    const csrfToken = this.csrfToken ?? (await this.session()).csrfToken;
    return envelope(await fetch(`/api/builder/projects/${encodeURIComponent(project.id)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({ project, expectedRevision })
    }));
  }

  async revisions(projectId: string): Promise<Array<{ revision: number; createdAt: string; contentHash: string; createdBy: string }>> {
    return envelope(await fetch(`/api/builder/projects/${encodeURIComponent(projectId)}/revisions`, { credentials: 'same-origin' }));
  }

  async restore(projectId: string, revision: number, expectedRevision: number): Promise<CmsProjectRecord> {
    const csrfToken = this.csrfToken ?? (await this.session()).csrfToken;
    return envelope(await fetch(`/api/builder/projects/${encodeURIComponent(projectId)}/revisions/${revision}/restore`, {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ expectedRevision })
    }));
  }

  async media(): Promise<BuilderMediaAsset[]> {
    return envelope(await fetch('/api/builder/media', { credentials: 'same-origin' }));
  }

  async upload(
    file: File,
    folder = '',
    input: {
      parentAssetId?: string;
      variantRole?: string;
      variantWidth?: number;
      focalX?: number;
      focalY?: number;
    } = {}
  ) {
    const csrfToken = this.csrfToken ?? (await this.session()).csrfToken;
    const form = new FormData();
    form.set('file', file);
    if (folder.trim()) form.set('folder', folder.trim());
    if (input.parentAssetId) form.set('parentAssetId', input.parentAssetId);
    if (input.variantRole) form.set('variantRole', input.variantRole);
    if (input.variantWidth) form.set('variantWidth', String(input.variantWidth));
    if (typeof input.focalX === 'number') form.set('focalX', String(input.focalX));
    if (typeof input.focalY === 'number') form.set('focalY', String(input.focalY));
    return envelope<BuilderMediaAsset>(await fetch('/api/builder/media', {
      method: 'POST', credentials: 'same-origin', headers: { 'x-csrf-token': csrfToken }, body: form
    }));
  }

  async updateMedia(assetId: string, input: { fileName?: string; folder?: string | null; focalX?: number; focalY?: number }) {
    const csrfToken = this.csrfToken ?? (await this.session()).csrfToken;
    return envelope<BuilderMediaAsset>(await fetch(`/api/builder/media/${encodeURIComponent(assetId)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(input)
    }));
  }

  async deleteMedia(assetId: string): Promise<void> {
    const csrfToken = this.csrfToken ?? (await this.session()).csrfToken;
    const response = await fetch(`/api/builder/media/${encodeURIComponent(assetId)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'x-csrf-token': csrfToken }
    });
    if (response.status === 204) return;
    const body = await response.json() as CmsErrorEnvelope;
    throw new BuilderGatewayError(body.error.code, body.error.message);
  }

  async submissions(): Promise<Array<{ id: string; projectId: string; pageId: string; formId: string; payload: Record<string, string>; createdAt: string }>> {
    return envelope(await fetch('/api/builder/forms/submissions', { credentials: 'same-origin' }));
  }

  async exportStatic(project: BuilderProject, target: BuilderExportTarget = 'static-html'): Promise<Blob> {
    const csrfToken = this.csrfToken ?? (await this.session()).csrfToken;
    const response = await fetch('/api/builder/export', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken }, body: JSON.stringify({ project, target }) });
    if (!response.ok) {
      const body = await response.json() as CmsErrorEnvelope;
      throw new BuilderGatewayError(body.error.code, body.error.message);
    }
    return response.blob();
  }

  async aiSettings(): Promise<BuilderAiSettingsStatus> {
    return envelope(await fetch('/api/builder/settings/ai', { credentials: 'same-origin' }));
  }

  async saveAiSettings(settings: BuilderAiSettingsUpdateRequest): Promise<BuilderAiSettingsStatus> {
    const csrfToken = this.csrfToken ?? (await this.session()).csrfToken;
    return envelope(await fetch('/api/builder/settings/ai', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(settings)
    }));
  }
}
