import { describe, expect, it } from 'vitest';
import { validateMedia } from '../src/lib/server/media-policy';

describe('media signature policy', () => {
  it('accepts GIF, MP4, WebM, and Lottie signatures', () => {
    expect(validateMedia('image/gif', new TextEncoder().encode('GIF89a content'))?.kind).toBe('image');
    expect(validateMedia('video/mp4', new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode('ftypisom')]))?.kind).toBe('video');
    expect(validateMedia('video/webm', new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]))?.kind).toBe('video');
    expect(validateMedia('application/json', new TextEncoder().encode(JSON.stringify({ fr: 30, ip: 0, op: 60, layers: [] })))?.kind).toBe('lottie');
  });

  it('rejects spoofed and malformed media', () => {
    expect(validateMedia('video/mp4', new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull();
    expect(validateMedia('image/gif', new TextEncoder().encode('not a gif'))).toBeNull();
    expect(validateMedia('application/json', new TextEncoder().encode('{"hello":"world"}'))).toBeNull();
  });
});
