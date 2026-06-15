import { describe, expect, it } from 'vitest';
import { shouldOptimizeImage } from '../src/lib/builder/image-optimizer';

describe('image optimizer gating', () => {
  it('optimizes supported raster images and skips gif', () => {
    expect(shouldOptimizeImage(new File(['a'], 'a.png', { type: 'image/png' }))).toBe(true);
    expect(shouldOptimizeImage(new File(['a'], 'a.webp', { type: 'image/webp' }))).toBe(true);
    expect(shouldOptimizeImage(new File(['a'], 'a.gif', { type: 'image/gif' }))).toBe(false);
    expect(shouldOptimizeImage(new File(['a'], 'a.mp4', { type: 'video/mp4' }))).toBe(false);
  });
});

