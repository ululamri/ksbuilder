import { describe, expect, it } from 'vitest';
import { sanitizeFocalCoordinate, sanitizeMediaFileName, sanitizeMediaFolder } from '../src/lib/server/local-media';

describe('local media file manager helpers', () => {
  it('sanitizes folder paths for builder file manager', () => {
    expect(sanitizeMediaFolder('/landing///hero assets/../../bad')).toBe('landing/hero assets/bad');
    expect(sanitizeMediaFolder('')).toBe('');
  });

  it('sanitizes file names and rejects empty names', () => {
    expect(sanitizeMediaFileName(' banner/final?.png ')).toBe('banner-final?.png');
    expect(() => sanitizeMediaFileName('   ')).toThrow('File name is required.');
  });

  it('clamps focal point values into a safe percent range', () => {
    expect(sanitizeFocalCoordinate(12.56)).toBe(12.6);
    expect(sanitizeFocalCoordinate(-10)).toBe(0);
    expect(sanitizeFocalCoordinate(120)).toBe(100);
    expect(sanitizeFocalCoordinate(Number.NaN, 42)).toBe(42);
  });
});
