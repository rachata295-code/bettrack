import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from '@/lib/id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('newId', () => {
  it('uses crypto.randomUUID when available', () => {
    expect(newId()).toMatch(UUID_V4);
  });

  it('falls back to getRandomValues when randomUUID is missing (insecure context)', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    const a = newId();
    const b = newId();
    expect(a).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });

  it('falls back to getRandomValues when randomUUID throws', () => {
    const real = globalThis.crypto;
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        throw new TypeError('insecure');
      },
      getRandomValues: real.getRandomValues.bind(real),
    });
    expect(newId()).toMatch(UUID_V4);
  });

  it('falls back to Math.random when crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    const a = newId();
    expect(a).toMatch(UUID_V4);
    expect(newId()).not.toBe(a);
  });
});
