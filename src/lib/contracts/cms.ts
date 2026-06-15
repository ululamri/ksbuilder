import type { BuilderProject } from '$lib/builder/types';

export const CMS_CONTRACT_VERSION = '2026-06-13';

export type CmsEnvelope<T> = {
  ok: true;
  data: T;
  meta: { contractVersion: string; requestId: string };
};

export type CmsErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'csrf_invalid'
  | 'validation_failed'
  | 'revision_conflict'
  | 'not_found'
  | 'rate_limited'
  | 'backend_unavailable'
  | 'internal_error';

export type CmsErrorEnvelope = {
  ok: false;
  error: { code: CmsErrorCode; message: string; fields?: Record<string, string> };
  meta: { contractVersion: string; requestId: string };
};

export type CmsProjectRecord = {
  project: BuilderProject;
  revision: number;
  publishedRevision: number | null;
  updatedAt: string;
};

export type SaveProjectRequest = {
  project: BuilderProject;
  expectedRevision: number;
};

export type PublishProjectRequest = {
  expectedRevision: number;
};

export type PublishProjectResult = {
  revision: number;
  publishedAt: string;
  publicUrl: string | null;
};

export type BuilderAiSettingsStatus = {
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom';
  model: string;
  apiBaseUrl: string;
  hasApiKey: boolean;
  updatedAt: string | null;
};

export type BuilderAiSettingsUpdateRequest = {
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom';
  apiKey?: string;
  model: string;
  apiBaseUrl: string;
};

export type CmsSession = {
  backendMode: 'local' | 'draft' | 'spark-api';
  authenticated: boolean;
  csrfToken: string;
  user?: { id: string; email: string; displayName: string; roles: string[] };
};
