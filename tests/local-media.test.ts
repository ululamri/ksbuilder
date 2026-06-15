import { describe, expect, it } from 'vitest';
import { sanitizeMediaFileName, sanitizeMediaFolder } from '../src/lib/server/local-media';

describe('local media file manager helpers', () => {
  it('sanitizes folder paths for builder file manager', () => {
    expect(sanitizeMediaFolder('/landing///hero assets/../../bad')).toBe('landing/hero assets/bad');
    expect(sanitizeMediaFolder('')).toBe('');
  });

  it('sanitizes file names and rejects empty names', () => {
    expect(sanitizeMediaFileName(' banner/final?.png ')).toBe('banner-final?.png');
    expect(() => sanitizeMediaFileName('   ')).toThrow('File name is required.');
  });
});
