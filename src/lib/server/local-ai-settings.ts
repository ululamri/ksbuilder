import { audit, localDb } from './local-db';
import type { LocalUser } from './local-auth';

export type LocalAiSettings = {
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom';
  apiKey: string;
  model: string;
  apiBaseUrl: string;
  updatedAt: string | null;
};

export type LocalAiSettingsStatus = Omit<LocalAiSettings, 'apiKey'> & { hasApiKey: boolean };

const DEFAULT_SETTINGS: LocalAiSettings = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4.1-mini',
  apiBaseUrl: 'https://api.openai.com/v1',
  updatedAt: null
};

export function getLocalAiSettings(): LocalAiSettings {
  const row = localDb().prepare('select provider, api_key, model, api_base_url, updated_at from local_ai_settings where id = 1').get() as Record<string, string> | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    provider: normalizeProvider(row.provider),
    apiKey: row.api_key ?? '',
    model: sanitizeString(row.model, DEFAULT_SETTINGS.model),
    apiBaseUrl: sanitizeUrl(row.api_base_url, DEFAULT_SETTINGS.apiBaseUrl),
    updatedAt: row.updated_at ?? null
  };
}

export function getLocalAiSettingsStatus(): LocalAiSettingsStatus {
  const settings = getLocalAiSettings();
  return { provider: settings.provider, model: settings.model, apiBaseUrl: settings.apiBaseUrl, updatedAt: settings.updatedAt, hasApiKey: Boolean(settings.apiKey) };
}

export function saveLocalAiSettings(input: Partial<LocalAiSettings>, user: LocalUser): LocalAiSettingsStatus {
  const current = getLocalAiSettings();
  const updatedAt = new Date().toISOString();
  const next: LocalAiSettings = {
    provider: input.provider ? normalizeProvider(input.provider) : current.provider,
    apiKey: input.apiKey !== undefined ? String(input.apiKey) : current.apiKey,
    model: sanitizeString(input.model, current.model),
    apiBaseUrl: sanitizeUrl(input.apiBaseUrl, current.apiBaseUrl),
    updatedAt
  };
  localDb().prepare(`
    insert into local_ai_settings (id, provider, api_key, model, api_base_url, updated_at)
    values (1, ?, ?, ?, ?, ?)
    on conflict(id) do update set provider = excluded.provider, api_key = excluded.api_key, model = excluded.model, api_base_url = excluded.api_base_url, updated_at = excluded.updated_at
  `).run(next.provider, next.apiKey, next.model, next.apiBaseUrl, updatedAt);
  audit('ai_settings.save', updatedAt, user.id, null, null, { provider: next.provider, model: next.model, hasApiKey: Boolean(next.apiKey) });
  return { provider: next.provider, model: next.model, apiBaseUrl: next.apiBaseUrl, updatedAt: next.updatedAt, hasApiKey: Boolean(next.apiKey) };
}

function normalizeProvider(value: unknown): LocalAiSettings['provider'] {
  return value === 'anthropic' || value === 'gemini' || value === 'custom' ? value : 'openai';
}

function sanitizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : fallback;
}

function sanitizeUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const next = value.trim().replace(/\/$/, '');
  return /^https:\/\/[^\s]+$/i.test(next) ? next.slice(0, 200) : fallback;
}
