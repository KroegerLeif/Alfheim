import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserApiSession } from '../session';
import { subscribeHouseholdErrors } from '../../household/householdStore';

describe('createBrowserApiSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    delete window.__alfheim_oidc__;
    vi.restoreAllMocks();
  });

  it('reads the token from the shared token store', () => {
    const session = createBrowserApiSession();
    expect(session.getToken()).toBeNull();
    sessionStorage.setItem('alfheim_access_token', 'tok');
    expect(session.getToken()).toBe('tok');
  });

  it('warns and sends no token when storage is blocked', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(createBrowserApiSession().getToken()).toBeNull();
    expect(warn).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('refreshes and logs in through the OIDC bridge', async () => {
    const session = createBrowserApiSession();
    expect(await session.refreshToken?.()).toBeNull();
    session.onAuthFailure?.();
    const login = vi.fn();
    window.__alfheim_oidc__ = { getToken: () => null, refresh: async () => 'fresh', login };
    expect(await session.refreshToken?.()).toBe('fresh');
    session.onAuthFailure?.();
    expect(login).toHaveBeenCalledOnce();
  });

  it('sets the active household and drops any role header', () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-1');
    const headers = new Headers({ 'X-Household-Role': 'OWNER' });
    createBrowserApiSession().prepareHeaders?.(headers);
    expect(headers.get('X-Household-ID')).toBe('hh-1');
    expect(headers.has('X-Household-Role')).toBe(false);
  });

  it('reports household errors', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHouseholdErrors(listener);
    const body = JSON.stringify({ detail: { code: 'household_required', message: 'm' } });
    await createBrowserApiSession().onErrorResponse?.(new Response(body, { status: 400 }));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ code: 'household_required' }));
    unsubscribe();
  });
});
