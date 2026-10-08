import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOidcAuth } from '../useOidcAuth';
import { InsecureContextError, IssuerUnreachableError, OidcConfig, OidcConfigError, OidcTokenSet } from '../oidcTypes';
import { makeJwt } from './testUtils';

const flow = vi.hoisted(() => ({
  beginLogin: vi.fn(),
  clearPersistedTokens: vi.fn(),
  completeLoginIfRedirected: vi.fn(),
  detectInsecureContext: vi.fn(),
  endSession: vi.fn(),
  loadPersistedTokens: vi.fn(),
  refreshTokens: vi.fn(),
}));
const config = vi.hoisted(() => ({ loadOidcConfig: vi.fn() }));
const validation = vi.hoisted(() => ({ isTokenSetValid: vi.fn() }));

vi.mock('../oidcFlow', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../oidcFlow')>()),
  ...flow,
}));
vi.mock('../oidcConfig', () => config);
vi.mock('../tokenValidation', () => validation);

const CONFIG: OidcConfig = {
  issuer: 'https://auth.example',
  clientId: 'client',
  redirectUri: 'https://app.example/pantry/',
  scope: 'openid',
};

function tokenSet(sub: string, overrides: Partial<OidcTokenSet> = {}): OidcTokenSet {
  return {
    accessToken: makeJwt({ sub, preferred_username: `${sub}-name`, email: `${sub}@example.com`, name: 'Ann' }),
    refreshToken: 'refresh-1',
    idToken: 'id-1',
    expiresAt: Date.now() + 3_600_000,
    ...overrides,
  };
}

describe('useOidcAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.loadOidcConfig.mockReturnValue(CONFIG);
    flow.detectInsecureContext.mockReturnValue(null);
    flow.completeLoginIfRedirected.mockResolvedValue(null);
    flow.loadPersistedTokens.mockReturnValue(null);
    flow.beginLogin.mockResolvedValue(undefined);
    flow.endSession.mockResolvedValue(undefined);
    validation.isTokenSetValid.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.__alfheim_oidc__;
  });

  it('reports a configuration error without starting the flow', async () => {
    config.loadOidcConfig.mockImplementation(() => {
      throw new OidcConfigError('missing issuer');
    });
    const { result } = renderHook(() => useOidcAuth({ basePath: '/pantry' }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.configError?.message).toBe('missing issuer');
    expect(config.loadOidcConfig).toHaveBeenCalledWith('/pantry');
    expect(flow.completeLoginIfRedirected).not.toHaveBeenCalled();
    expect(window.__alfheim_oidc__).toBeUndefined();
  });

  it('rethrows unexpected configuration errors', () => {
    config.loadOidcConfig.mockImplementation(() => {
      throw new TypeError('bug');
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useOidcAuth())).toThrow('bug');
    spy.mockRestore();
  });

  it('stops on an insecure context before touching storage', async () => {
    const insecure = new InsecureContextError('app.lan', 'https://app.lan/');
    flow.detectInsecureContext.mockReturnValue(insecure);
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.insecureContextError).toBe(insecure);
    expect(flow.loadPersistedTokens).not.toHaveBeenCalled();
  });

  it('applies tokens from a completed redirect and exposes the bridge', async () => {
    const tokens = tokenSet('user-1');
    flow.completeLoginIfRedirected.mockResolvedValue(tokens);
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.token).toBe(tokens.accessToken);
    expect(result.current.user).toMatchObject({ sub: 'user-1', email: 'user-1@example.com', name: 'Ann' });
    expect(window.__alfheim_oidc__?.getToken()).toBe(tokens.accessToken);
    expect(flow.loadPersistedTokens).not.toHaveBeenCalled();
  });

  it('restores a valid persisted session without refreshing', async () => {
    const tokens = tokenSet('user-2');
    flow.loadPersistedTokens.mockReturnValue(tokens);
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(flow.refreshTokens).not.toHaveBeenCalled();
    expect(result.current.user?.sub).toBe('user-2');
  });

  it('refreshes a stale persisted session once before using it', async () => {
    const stale = tokenSet('user-3');
    const fresh = tokenSet('user-3', { accessToken: makeJwt({ sub: 'user-3', preferred_username: 'u', email: 'e' }) });
    flow.loadPersistedTokens.mockReturnValue(stale);
    validation.isTokenSetValid.mockImplementation((tokens: OidcTokenSet) => tokens === fresh);
    flow.refreshTokens.mockResolvedValue(fresh);
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(flow.refreshTokens).toHaveBeenCalledWith(CONFIG, 'refresh-1');
    expect(result.current.token).toBe(fresh.accessToken);
  });

  it('discards an invalid session without a refresh token and starts a login', async () => {
    flow.loadPersistedTokens.mockReturnValue(tokenSet('user-4', { refreshToken: null }));
    validation.isTokenSetValid.mockReturnValue(false);
    renderHook(() => useOidcAuth());
    await waitFor(() => expect(flow.beginLogin).toHaveBeenCalledWith(CONFIG));
    expect(flow.refreshTokens).not.toHaveBeenCalled();
    expect(flow.clearPersistedTokens).toHaveBeenCalled();
  });

  it.each([
    ['an insecure context', new InsecureContextError('h', 'https://h/'), 'insecureContextError'],
    ['an unreachable issuer', new IssuerUnreachableError('https://i', 'https://i/d', 'i'), 'issuerUnreachableError'],
  ] as const)('reports %s when starting the login fails', async (_label, error, field) => {
    flow.beginLogin.mockRejectedValue(error);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current[field]).toBe(error));
    expect(result.current.isLoading).toBe(false);
    spy.mockRestore();
  });

  it.each([
    [new Error('discovery returned 500'), 'discovery returned 500'],
    ['not an error', 'Failed to reach the identity provider.'],
  ])('reports a discovery error when starting the login fails with %s', async (error, message) => {
    flow.beginLogin.mockRejectedValue(error);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.discoveryError).toBe(message));
    spy.mockRestore();
  });

  it.each([
    [new IssuerUnreachableError('https://i', 'https://i/d', 'i'), null],
    [new Error('token exchange failed'), 'token exchange failed'],
    [42, 'Failed to reach the identity provider.'],
  ])('reports initialization failure %#', async (error, discoveryError) => {
    flow.completeLoginIfRedirected.mockRejectedValue(error);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.discoveryError).toBe(discoveryError);
    expect(result.current.issuerUnreachableError).toBe(error instanceof IssuerUnreachableError ? error : null);
    spy.mockRestore();
  });

  it('refreshes through the bridge and keeps the session when refresh fails', async () => {
    const tokens = tokenSet('user-5');
    const next = tokenSet('user-5', { accessToken: makeJwt({ sub: 'user-5', preferred_username: 'n', email: 'n' }) });
    flow.loadPersistedTokens.mockReturnValue(tokens);
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    flow.refreshTokens.mockResolvedValueOnce(null);
    await act(async () => {
      expect(await window.__alfheim_oidc__!.refresh()).toBeNull();
    });
    expect(result.current.token).toBe(tokens.accessToken);

    flow.refreshTokens.mockResolvedValueOnce(next);
    await act(async () => {
      expect(await window.__alfheim_oidc__!.refresh()).toBe(next.accessToken);
    });
    expect(result.current.token).toBe(next.accessToken);
  });

  it('logs out by clearing tokens and ending the session with the id token', async () => {
    flow.loadPersistedTokens.mockReturnValue(tokenSet('user-6'));
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    act(() => result.current.logout());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(flow.clearPersistedTokens).toHaveBeenCalled();
    expect(flow.endSession).toHaveBeenCalledWith(CONFIG, 'id-1');
  });

  it('ignores login and logout calls before a configuration is loaded', async () => {
    config.loadOidcConfig.mockImplementation(() => {
      throw new OidcConfigError('missing');
    });
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.login();
      result.current.logout();
    });
    expect(flow.beginLogin).not.toHaveBeenCalled();
    expect(flow.endSession).not.toHaveBeenCalled();
  });

  it('silently refreshes before expiry and logs out when that refresh fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    flow.loadPersistedTokens.mockReturnValue(tokenSet('user-7', { expiresAt: Date.now() + 61_000 }));
    flow.refreshTokens.mockResolvedValue(null);
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(flow.refreshTokens).toHaveBeenCalledWith(CONFIG, 'refresh-1');
    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(flow.endSession).toHaveBeenCalled();
  });
});
