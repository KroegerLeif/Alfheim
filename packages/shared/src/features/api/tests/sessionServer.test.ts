import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserApiSession } from '../session';

/** Server render: without `window` the session sends no token and never redirects. */
describe('createBrowserApiSession without a window', () => {
  beforeEach(() => {
    vi.stubGlobal('window', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has no token and nothing to refresh', async () => {
    const session = createBrowserApiSession();
    expect(session.getToken()).toBeNull();
    expect(await session.refreshToken?.()).toBeNull();
  });

  it('neither logs in nor adds household headers', () => {
    const session = createBrowserApiSession();
    expect(() => session.onAuthFailure?.()).not.toThrow();
    const headers = new Headers();
    session.prepareHeaders?.(headers);
    expect(headers.has('X-Household-ID')).toBe(false);
  });
});
