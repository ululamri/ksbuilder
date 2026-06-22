import { describe, expect, it } from 'vitest';
import {
  CMS_COMPATIBLE_CONTRACT_VERSIONS,
  CMS_CONTRACT_VERSION,
  normalizeCmsAuthMe,
  normalizeCmsProjectList,
  normalizeCmsProjectRecord,
  normalizeCmsRevisionList,
  normalizePublishProjectResult,
  normalizeUploadIntent
} from '../src/lib/contracts/cms';

describe('cms contract compatibility', () => {
  it('tracks the current backend contract version', () => {
    expect(CMS_CONTRACT_VERSION).toBe('2026-06-22');
    expect(CMS_COMPATIBLE_CONTRACT_VERSIONS).toContain('2026-06-13');
  });

  it('normalizes auth, project, revision, publish, and upload-intent payloads', () => {
    expect(normalizeCmsAuthMe({ user: { id: '1', email: 'admin@example.com', display_name: 'Admin', roles: ['cms_admin'] } }))
      .toEqual({ user: { id: '1', email: 'admin@example.com', displayName: 'Admin', roles: ['cms_admin'] } });

    expect(normalizeCmsProjectRecord({ project: { id: 'p', name: 'Project' }, current_revision: '7', published_revision: '5', updated_at: '2026-06-22T00:00:00.000Z' }))
      .toMatchObject({ revision: 7, publishedRevision: 5, updatedAt: '2026-06-22T00:00:00.000Z' });

    expect(normalizeCmsProjectList([{ id: 'p', name: 'Project', current_revision: 7, published_revision: 5, updated_at: '2026-06-22T00:00:00.000Z' }]))
      .toEqual([{ id: 'p', name: 'Project', revision: 7, publishedRevision: 5, updatedAt: '2026-06-22T00:00:00.000Z' }]);

    expect(normalizeCmsRevisionList([{ revision: 2, created_at: '2026-06-22T00:00:00.000Z', content_hash: 'abc', created_by: 'admin@example.com' }]))
      .toEqual([{ revision: 2, createdAt: '2026-06-22T00:00:00.000Z', contentHash: 'abc', createdBy: 'admin@example.com' }]);

    expect(normalizePublishProjectResult({ revision: '9', published_at: '2026-06-22T00:00:00.000Z', public_url: '/site/p' }))
      .toEqual({ revision: 9, publishedAt: '2026-06-22T00:00:00.000Z', publicUrl: '/site/p' });

    expect(normalizeUploadIntent({ asset_id: 'a', upload_url: 'https://upload.example.com', method: 'PUT', headers: { 'content-type': 'image/png' }, expires_at: '2026-06-22T00:00:00.000Z' }))
      .toEqual({
        assetId: 'a',
        uploadUrl: 'https://upload.example.com',
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        expiresAt: '2026-06-22T00:00:00.000Z'
      });
  });
});
