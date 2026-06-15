import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { builderConfig } from './config';
import { audit, localDb } from './local-db';
import type { LocalUser } from './local-auth';
import { CmsClientError } from './cms-client';
import { MEDIA_POLICIES, validateMedia } from './media-policy';

type LocalMediaRow = {
  id: string;
  file_name: string;
  content_type: string;
  size: number;
  folder: string;
  asset_group_id: string;
  variant_role: string;
  width: number;
  focal_x: number;
  focal_y: number;
  storage_name: string;
  created_at: string;
  updated_at: string;
};

export type LocalMediaVariant = {
  id: string;
  contentType: string;
  size: number;
  width: number;
  variantRole: string;
  url: string;
};

export type LocalMediaAsset = {
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
  variants: LocalMediaVariant[];
};

export function listLocalMedia(user: LocalUser): LocalMediaAsset[] {
  const rows = localDb().prepare(`
    select id, file_name, content_type, size, folder, asset_group_id, variant_role, width, focal_x, focal_y, storage_name, created_at, updated_at
    from local_media
    where owner_id = ? and variant_role = 'original'
    order by updated_at desc, created_at desc
    limit 500
  `).all(user.id) as LocalMediaRow[];
  const variants = localDb().prepare(`
    select id, file_name, content_type, size, folder, asset_group_id, variant_role, width, focal_x, focal_y, storage_name, created_at, updated_at
    from local_media
    where owner_id = ? and variant_role != 'original'
    order by width asc, created_at asc
  `).all(user.id) as LocalMediaRow[];
  const byGroup = new Map<string, LocalMediaVariant[]>();
  for (const row of variants) {
    const items = byGroup.get(row.asset_group_id) ?? [];
    items.push({
      id: row.id,
      contentType: row.content_type,
      size: Number(row.size),
      width: Number(row.width) || 0,
      variantRole: row.variant_role,
      url: `/api/builder/media/${row.id}`
    });
    byGroup.set(row.asset_group_id, items);
  }
  return rows.map((row) => toAsset(row, byGroup.get(row.asset_group_id || row.id) ?? []));
}

export async function createLocalMediaFromFile(
  file: File,
  user: LocalUser,
  requestId: string,
  input: {
    folder?: string | null;
    parentAssetId?: string | null;
    variantRole?: string | null;
    variantWidth?: number | null;
    focalX?: number | null;
    focalY?: number | null;
  } = {}
): Promise<LocalMediaAsset> {
  if (!MEDIA_POLICIES[file.type]) throw new CmsClientError(422, 'validation_failed', 'Media type is not supported.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  return createLocalMediaFromBuffer(file, bytes, user, requestId, input);
}

function createLocalMediaFromBuffer(
  file: File,
  bytes: Uint8Array,
  user: LocalUser,
  requestId: string,
  input: {
    folder?: string | null;
    parentAssetId?: string | null;
    variantRole?: string | null;
    variantWidth?: number | null;
    focalX?: number | null;
    focalY?: number | null;
  }
): LocalMediaAsset {
  const policy = validateMedia(file.type, bytes);
  if (!policy) throw new CmsClientError(422, 'validation_failed', 'Media signature, structure, or file size is invalid.');
  const originalName = sanitizeMediaFileName(file.name);
  const parentRow = input.parentAssetId
    ? localDb().prepare(`
      select id, owner_id, content_type, folder, asset_group_id, focal_x, focal_y
      from local_media
      where id = ? and owner_id = ?
    `).get(input.parentAssetId, user.id) as {
      id: string;
      owner_id: string;
      content_type: string;
      folder: string;
      asset_group_id: string;
      focal_x: number;
      focal_y: number;
    } | undefined
    : undefined;
  if (input.parentAssetId && !parentRow) throw new CmsClientError(404, 'not_found', 'Parent media was not found.');
  if (parentRow && (!policy.kind || policy.kind !== 'image' || !parentRow.content_type.startsWith('image/'))) {
    throw new CmsClientError(422, 'validation_failed', 'Responsive variants are only supported for images.');
  }
  const folder = sanitizeMediaFolder(input.folder ?? parentRow?.folder ?? null);
  const extension = policy.extension;
  const id = crypto.randomUUID();
  const assetGroupId = parentRow?.asset_group_id || id;
  const variantWidth = parentRow ? sanitizeVariantWidth(input.variantWidth) : 0;
  const variantRole = parentRow ? sanitizeVariantRole(input.variantRole, variantWidth) : 'original';
  const focalX = parentRow ? Number(parentRow.focal_x) || 50 : sanitizeFocalCoordinate(input.focalX, 50);
  const focalY = parentRow ? Number(parentRow.focal_y) || 50 : sanitizeFocalCoordinate(input.focalY, 50);
  const storageName = `${id}${extension}`;
  const directory = join(builderConfig().dataDir, 'media');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(join(directory, storageName), bytes, { mode: 0o600 });
  const now = new Date().toISOString();
  localDb().prepare(`
    insert into local_media (
      id, owner_id, file_name, content_type, size, folder, asset_group_id, variant_role, width, focal_x, focal_y, storage_name, created_at, updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, user.id, originalName, file.type, file.size, folder, assetGroupId, variantRole, variantWidth, focalX, focalY, storageName, now, now);
  audit('media.create', requestId, user.id, null, null, { id, assetGroupId, variantRole, variantWidth, contentType: file.type, size: file.size, folder });
  const row = localDb().prepare(`
    select id, file_name, content_type, size, folder, asset_group_id, variant_role, width, focal_x, focal_y, storage_name, created_at, updated_at
    from local_media
    where id = ? and owner_id = ?
  `).get(parentRow?.id ?? id, user.id) as LocalMediaRow | undefined;
  if (!row) throw new CmsClientError(500, 'internal_error', 'Media could not be created.');
  const variants = localDb().prepare(`
    select id, file_name, content_type, size, folder, asset_group_id, variant_role, width, focal_x, focal_y, storage_name, created_at, updated_at
    from local_media
    where owner_id = ? and asset_group_id = ? and variant_role != 'original'
    order by width asc, created_at asc
  `).all(user.id, row.asset_group_id) as LocalMediaRow[];
  return toAsset(row, variants.map(toVariant));
}

export function updateLocalMedia(assetId: string, user: LocalUser, requestId: string, input: { fileName?: string; folder?: string | null; focalX?: number; focalY?: number }): LocalMediaAsset {
  const row = localDb().prepare(`
    select id, file_name, content_type, size, folder, asset_group_id, variant_role, width, focal_x, focal_y, storage_name, created_at, updated_at
    from local_media
    where id = ? and owner_id = ?
  `).get(assetId, user.id) as LocalMediaRow | undefined;
  if (!row) throw new CmsClientError(404, 'not_found', 'Media was not found.');
  const fileName = input.fileName !== undefined ? sanitizeMediaFileName(input.fileName) : row.file_name;
  const folder = input.folder !== undefined ? sanitizeMediaFolder(input.folder) : row.folder;
  const focalX = input.focalX !== undefined ? sanitizeFocalCoordinate(input.focalX, Number(row.focal_x) || 50) : Number(row.focal_x) || 50;
  const focalY = input.focalY !== undefined ? sanitizeFocalCoordinate(input.focalY, Number(row.focal_y) || 50) : Number(row.focal_y) || 50;
  const updatedAt = new Date().toISOString();
  localDb().prepare(`
    update local_media
    set file_name = ?, folder = ?, focal_x = ?, focal_y = ?, updated_at = ?
    where id = ? and owner_id = ?
  `).run(fileName, folder, focalX, focalY, updatedAt, assetId, user.id);
  localDb().prepare(`
    update local_media
    set folder = ?, updated_at = ?
    where asset_group_id = ? and owner_id = ? and id != ?
  `).run(folder, updatedAt, row.asset_group_id, user.id, assetId);
  audit('media.update', requestId, user.id, null, null, { id: assetId, fileName, folder, focalX, focalY });
  const variants = localDb().prepare(`
    select id, file_name, content_type, size, folder, asset_group_id, variant_role, width, focal_x, focal_y, storage_name, created_at, updated_at
    from local_media
    where owner_id = ? and asset_group_id = ? and variant_role != 'original'
    order by width asc, created_at asc
  `).all(user.id, row.asset_group_id) as LocalMediaRow[];
  return toAsset({ ...row, file_name: fileName, folder, focal_x: focalX, focal_y: focalY, updated_at: updatedAt }, variants.map(toVariant));
}

export function deleteLocalMedia(assetId: string, user: LocalUser, requestId: string): void {
  const row = localDb().prepare(`
    select id, storage_name, asset_group_id, variant_role
    from local_media
    where id = ? and owner_id = ?
  `).get(assetId, user.id) as { id: string; storage_name: string; asset_group_id: string; variant_role: string } | undefined;
  if (!row) throw new CmsClientError(404, 'not_found', 'Media was not found.');
  const rows = localDb().prepare(`
    select id, storage_name
    from local_media
    where owner_id = ? and asset_group_id = ?
  `).all(user.id, row.asset_group_id) as Array<{ id: string; storage_name: string }>;
  const ids = row.variant_role === 'original' ? rows.map((item) => item.id) : [assetId];
  if (mediaIdsReferenced(ids)) throw new CmsClientError(422, 'validation_failed', 'Media masih dipakai oleh proyek aktif atau situs yang sudah terbit.');
  if (row.variant_role === 'original') {
    localDb().prepare('delete from local_media where owner_id = ? and asset_group_id = ?').run(user.id, row.asset_group_id);
    for (const item of rows) try { unlinkSync(join(builderConfig().dataDir, 'media', item.storage_name)); } catch {}
  } else {
    localDb().prepare('delete from local_media where id = ? and owner_id = ?').run(assetId, user.id);
    try { unlinkSync(join(builderConfig().dataDir, 'media', row.storage_name)); } catch {}
  }
  audit('media.delete', requestId, user.id, null, null, { id: assetId, assetGroupId: row.asset_group_id, deletedCount: ids.length });
}

export function mediaPath(assetId: string, user: LocalUser): { path: string; contentType: string } {
  const row = localDb().prepare('select storage_name, content_type from local_media where id = ? and owner_id = ?').get(assetId, user.id) as { storage_name: string; content_type: string } | undefined;
  if (!row) throw new CmsClientError(404, 'not_found', 'Media was not found.');
  return { path: join(builderConfig().dataDir, 'media', row.storage_name), contentType: row.content_type };
}

function mediaIdsReferenced(assetIds: string[]): boolean {
  if (assetIds.length === 0) return false;
  for (const assetId of assetIds) {
    const marker = `/api/builder/media/${assetId}`;
    const row = localDb().prepare(`
      select 1
      from local_projects p
      join local_revisions current_r on current_r.project_id = p.id and current_r.revision = p.current_revision
      left join local_revisions published_r on published_r.project_id = p.id and published_r.revision = p.published_revision
      where instr(current_r.document, ?) > 0 or instr(coalesce(published_r.document, ''), ?) > 0
      limit 1
    `).get(marker, marker);
    if (row) return true;
  }
  return false;
}

export function sanitizeMediaFileName(value: string): string {
  const cleaned = String(value || '').trim().replace(/[\\/\u0000-\u001f]+/g, '-').slice(0, 180);
  if (!cleaned) throw new CmsClientError(422, 'validation_failed', 'File name is required.');
  return cleaned;
}

export function sanitizeMediaFolder(value: string | null | undefined): string {
  if (!value) return '';
  const folder = String(value)
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
    .split('/')
    .map((segment) => segment.replace(/[^a-z0-9 _-]/gi, '').trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 5)
    .join('/');
  return folder.slice(0, 160);
}

export function sanitizeFocalCoordinate(value: number | null | undefined, fallback = 50): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric * 10) / 10));
}

function sanitizeVariantWidth(value: number | null | undefined): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 320) throw new CmsClientError(422, 'validation_failed', 'Variant width is invalid.');
  return Math.max(320, Math.min(2560, Math.round(numeric)));
}

function sanitizeVariantRole(value: string | null | undefined, width: number): string {
  const cleaned = String(value || `w${width}`).trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
  return cleaned || `w${width}`;
}

function toVariant(row: LocalMediaRow): LocalMediaVariant {
  return {
    id: row.id,
    contentType: row.content_type,
    size: Number(row.size),
    width: Number(row.width) || 0,
    variantRole: row.variant_role,
    url: `/api/builder/media/${row.id}`
  };
}

function toAsset(row: LocalMediaRow, variants: LocalMediaVariant[]): LocalMediaAsset {
  return {
    id: row.id,
    fileName: row.file_name,
    contentType: row.content_type,
    size: Number(row.size),
    folder: row.folder ?? '',
    focalX: sanitizeFocalCoordinate(row.focal_x, 50),
    focalY: sanitizeFocalCoordinate(row.focal_y, 50),
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    url: `/api/builder/media/${row.id}`,
    variants
  };
}
