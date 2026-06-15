import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/lib/server/local-db';

describe('local password hashing', () => {
  it('uses a salted scrypt hash', () => {
    const first = hashPassword('a sufficiently long password');
    const second = hashPassword('a sufficiently long password');
    expect(first).not.toBe(second);
    expect(first.startsWith('scrypt:')).toBe(true);
    expect(verifyPassword('a sufficiently long password', first)).toBe(true);
    expect(verifyPassword('wrong password', first)).toBe(false);
  });
});
