import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateW3CTraceparent } from '../traceparent';

const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/;

function fillWith(value: number) {
  return <T extends ArrayBufferView>(array: T): T => {
    new Uint8Array(array.buffer).fill(value);
    return array;
  };
}

describe('generateW3CTraceparent crypto sources', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses window.crypto when the global crypto has no getRandomValues', () => {
    const getRandomValues = vi.fn(fillWith(7));
    vi.stubGlobal('crypto', {});
    vi.stubGlobal('window', { crypto: { getRandomValues } });
    expect(generateW3CTraceparent()).toBe(`00-${'07'.repeat(16)}-${'07'.repeat(8)}-01`);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it('throws when neither source can generate random values', () => {
    vi.stubGlobal('crypto', undefined);
    vi.stubGlobal('window', { crypto: {} });
    expect(() => generateW3CTraceparent()).toThrow('crypto.getRandomValues is not available');
  });

  it('throws without a window or a global crypto', () => {
    vi.stubGlobal('crypto', undefined);
    vi.stubGlobal('window', undefined);
    expect(() => generateW3CTraceparent()).toThrow('crypto.getRandomValues is not available');
  });

  it('throws when window has no crypto', () => {
    vi.stubGlobal('crypto', undefined);
    vi.stubGlobal('window', {});
    expect(() => generateW3CTraceparent()).toThrow('crypto.getRandomValues is not available');
  });

  it('formats a valid header with the native crypto', () => {
    expect(generateW3CTraceparent()).toMatch(TRACEPARENT);
  });
});
