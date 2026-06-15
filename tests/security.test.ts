import { describe, expect, it } from 'vitest';
import { safeImage, safeLink, safeSlug } from '../src/lib/builder/security';

describe('builder URL security', () => {
  it('allows internal and HTTPS links', () => {
    expect(safeLink('/core/start')).toBe('/core/start');
    expect(safeLink('https://example.com/path')).toBe('https://example.com/path');
  });

  it('rejects executable and insecure protocols', () => {
    expect(safeLink('javascript:alert(1)')).toBe('#');
    expect(safeLink('http://example.com')).toBe('#');
    expect(safeImage('data:text/html,test')).toBe('');
  });

  it('allows controlled local media paths', () => {
    expect(safeImage('/api/builder/media/123e4567-e89b-12d3-a456-426614174000')).toContain('/api/builder/media/');
    expect(safeImage('/private/file.jpg')).toBe('');
  });

  it('normalizes slugs', () => {
    expect(safeSlug('  Belajar Web3: Dasar! ')).toBe('belajar-web3-dasar');
  });
});
