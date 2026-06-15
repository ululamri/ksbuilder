export type MediaKind = 'image' | 'video' | 'lottie';

export type MediaPolicy = { extension: string; maxSize: number; kind: MediaKind };

export const MEDIA_POLICIES: Record<string, MediaPolicy> = {
  'image/jpeg': { extension: '.jpg', maxSize: 10_000_000, kind: 'image' },
  'image/png': { extension: '.png', maxSize: 10_000_000, kind: 'image' },
  'image/webp': { extension: '.webp', maxSize: 10_000_000, kind: 'image' },
  'image/avif': { extension: '.avif', maxSize: 10_000_000, kind: 'image' },
  'image/gif': { extension: '.gif', maxSize: 15_000_000, kind: 'image' },
  'video/mp4': { extension: '.mp4', maxSize: 50_000_000, kind: 'video' },
  'video/webm': { extension: '.webm', maxSize: 50_000_000, kind: 'video' },
  'application/json': { extension: '.json', maxSize: 2_000_000, kind: 'lottie' }
};

export function validateMedia(contentType: string, bytes: Uint8Array): MediaPolicy | null {
  const policy = MEDIA_POLICIES[contentType];
  if (!policy || bytes.length < 1 || bytes.length > policy.maxSize) return null;
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 ? policy : null;
  if (contentType === 'image/png') return matches(bytes, [0x89, 0x50, 0x4e, 0x47]) ? policy : null;
  if (contentType === 'image/gif') return new TextDecoder().decode(bytes.slice(0, 6)).match(/^GIF8[79]a$/) ? policy : null;
  if (contentType === 'image/webp') return text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 12) === 'WEBP' ? policy : null;
  if (contentType === 'image/avif') return text(bytes, 4, 12).includes('ftypavif') || text(bytes, 4, 12).includes('ftypavis') ? policy : null;
  if (contentType === 'video/mp4') return text(bytes, 4, 12).startsWith('ftyp') ? policy : null;
  if (contentType === 'video/webm') return matches(bytes, [0x1a, 0x45, 0xdf, 0xa3]) ? policy : null;
  if (contentType === 'application/json') {
    try {
      const value = JSON.parse(new TextDecoder().decode(bytes));
      return value && typeof value === 'object' && Number.isFinite(value.fr) && Number.isFinite(value.ip) && Number.isFinite(value.op) && Array.isArray(value.layers) ? policy : null;
    } catch { return null; }
  }
  return null;
}

function matches(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function text(bytes: Uint8Array, start: number, end: number) {
  return new TextDecoder().decode(bytes.slice(start, end));
}
