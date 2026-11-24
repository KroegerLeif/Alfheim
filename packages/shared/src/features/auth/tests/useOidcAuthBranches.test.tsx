import React, { StrictMode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOidcAuth } from '../useOidcAuth';
import type { OidcConfig, OidcTokenSet } from '../oidcTypes';
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
  redirectUri: 'https://app.example/',
  scope: 'openid',
};

function tokenSet(accessToken: string, expiresAt = Date.now() + 3_600_000): OidcTokenSet {
  return { accessToken, refreshToken: 'refresh-1', idToken: 'id-1', expiresAt };
}

describe('useOidcAuth edge branches', () => {
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

  it('initializes once when StrictMode runs the effect twice', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <StrictMode>{children}</StrictMode>;
    renderHook(() => useOidcAuth(), { wrapper });
    await waitFor(() => expect(flow.beginLogin).toHaveBeenCalled());
    expect(config.loadOidcConfig).toHaveBeenCalledTimes(1);
  });

  it('keeps the session but has no user when the access token cannot be decoded', async () => {
    flow.completeLoginIfRedirected.mockResolvedValue(tokenSet('opaque-token'));
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.token).toBe('opaque-token');
    expect(result.current.user).toBeNull();
  });

  it('answers bridge calls before any session exists', async () => {
    flow.refreshTokens.mockResolvedValue(null);
    renderHook(() => useOidcAuth());
    await waitFor(() => expect(flow.beginLogin).toHaveBeenCalled());

    const bridge = window.__alfheim_oidc__;
    expect(bridge?.getToken()).toBeNull();
    await act(async () => {
      expect(await bridge?.refresh()).toBeNull();
    });
    expect(flow.refreshTokens).toHaveBeenCalledWith(CONFIG, null);
  });

  it('keeps the session when the scheduled silent refresh succeeds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = tokenSet(makeJwt({ sub: 'user-1' }), Date.now() + 61_000);
    const next = tokenSet(makeJwt({ sub: 'user-1', email: 'next@example.com' }));
    flow.loadPersistedTokens.mockReturnValue(first);
    flow.refreshTokens.mockResolvedValue(next);
    const { result } = renderHook(() => useOidcAuth());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    await waitFor(() => expect(result.current.token).toBe(next.accessToken));
    expect(result.current.isAuthenticated).toBe(true);
    expect(flow.endSession).not.toHaveBeenCalled();
  });
});
