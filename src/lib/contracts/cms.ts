import type { BuilderProject } from '$lib/builder/types';

export const CMS_CONTRACT_VERSION = '2026-06-22';
export const CMS_COMPATIBLE_CONTRACT_VERSIONS = ['2026-06-22', '2026-06-13'] as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function intValue(value: unknown): number | null {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : numberValue(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function rolesValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function pickString(record: UnknownRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return null;
}

function pickInt(record: UnknownRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = intValue(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function pickNullableInt(record: UnknownRecord, ...keys: string[]): number | null {
  const value = pickInt(record, ...keys);
  return value ?? null;
}

export type CmsUser = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
};

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
  user?: CmsUser;
};

export function normalizeCmsUser(input: unknown): CmsUser | null {
  const record = isRecord(input) ? input : null;
  if (!record) return null;
  const id = pickString(record, 'id');
  const email = pickString(record, 'email');
  const displayName = pickString(record, 'displayName', 'display_name', 'name');
  if (!id || !email || !displayName) return null;
  return { id, email, displayName, roles: rolesValue(record.roles ?? record.role_names ?? record.cms_roles ?? record.permissions) };
}

export function normalizeCmsAuthMe(input: unknown): { user: CmsUser } | null {
  const record = isRecord(input) ? input : null;
  if (!record) return null;
  const user = normalizeCmsUser(record.user ?? input);
  return user ? { user } : null;
}

export function normalizeCmsProjectRecord(input: unknown): CmsProjectRecord | null {
  const record = isRecord(input) ? input : null;
  if (!record || !isRecord(record.project)) return null;
  const revision = pickInt(record, 'revision', 'current_revision');
  const publishedRevision = pickNullableInt(record, 'publishedRevision', 'published_revision');
  const updatedAt = pickString(record, 'updatedAt', 'updated_at');
  if (revision === null || !updatedAt) return null;
  return {
    project: record.project as BuilderProject,
    revision,
    publishedRevision,
    updatedAt
  };
}

export function normalizeCmsProjectList(input: unknown): Array<{ id: string; name: string; revision: number; publishedRevision: number | null; updatedAt: string }> | null {
  if (!Array.isArray(input)) return null;
  const rows = input.map((item) => {
    const record = isRecord(item) ? item : null;
    if (!record) return null;
    const id = pickString(record, 'id');
    const name = pickString(record, 'name');
    const revision = pickInt(record, 'revision', 'current_revision');
    const publishedRevision = pickNullableInt(record, 'publishedRevision', 'published_revision');
    const updatedAt = pickString(record, 'updatedAt', 'updated_at');
    if (!id || !name || revision === null || !updatedAt) return null;
    return { id, name, revision, publishedRevision, updatedAt };
  });
  return rows.every(Boolean) ? rows as Array<{ id: string; name: string; revision: number; publishedRevision: number | null; updatedAt: string }> : null;
}

export function normalizeCmsRevisionList(input: unknown): Array<{ revision: number; createdAt: string; contentHash: string; createdBy: string }> | null {
  if (!Array.isArray(input)) return null;
  const revisions = input.map((item) => {
    const record = isRecord(item) ? item : null;
    if (!record) return null;
    const revision = pickInt(record, 'revision');
    const createdAt = pickString(record, 'createdAt', 'created_at');
    const contentHash = pickString(record, 'contentHash', 'content_hash');
    const createdBy = pickString(record, 'createdBy', 'created_by');
    if (revision === null || !createdAt || !contentHash || !createdBy) return null;
    return { revision, createdAt, contentHash, createdBy };
  });
  return revisions.every(Boolean) ? revisions as Array<{ revision: number; createdAt: string; contentHash: string; createdBy: string }> : null;
}

export function normalizePublishProjectResult(input: unknown): PublishProjectResult | null {
  const record = isRecord(input) ? input : null;
  if (!record) return null;
  const revision = pickInt(record, 'revision');
  const publishedAt = pickString(record, 'publishedAt', 'published_at');
  const publicUrl = pickString(record, 'publicUrl', 'public_url', 'url');
  if (revision === null || !publishedAt) return null;
  return { revision, publishedAt, publicUrl: publicUrl ?? null };
}

export function normalizeUploadIntent(input: unknown): { assetId: string; uploadUrl: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string } | null {
  const record = isRecord(input) ? input : null;
  if (!record) return null;
  const assetId = pickString(record, 'assetId', 'asset_id');
  const uploadUrl = pickString(record, 'uploadUrl', 'upload_url');
  const method = pickString(record, 'method') === 'PUT' ? 'PUT' : null;
  const expiresAt = pickString(record, 'expiresAt', 'expires_at');
  const headers = isRecord(record.headers)
    ? Object.fromEntries(Object.entries(record.headers).filter(([, value]) => typeof value === 'string')) as Record<string, string>
    : null;
  if (!assetId || !uploadUrl || !method || !expiresAt || !headers) return null;
  return { assetId, uploadUrl, method, headers, expiresAt };
}
