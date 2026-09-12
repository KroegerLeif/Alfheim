'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserIdentityClaims } from '../providers/AuthProvider';
import { setInMemoryToken } from '../providers/AuthProvider';
import {
  beginLogin,
  clearPersistedTokens,
  completeLoginIfRedirected,
  decodeClaims,
  endSession,
  loadOidcConfig,
  loadPersistedTokens,
  refreshTokens,
  type OidcTokenSet,
} from './oidc';

/** Bridge object consumed by the centralized API client for reactive 401 handling. */
export interface OidcBridge {
  getToken: () => string | null;
  refresh: () => Promise<string | null>;
  login: () => void;
}

declare global {
  interface Window {
    __alfheim_oidc__?: OidcBridge;
  }
}

// Refresh the access token this many milliseconds before it actually expires.
const REFRESH_SKEW_MS = 60_000;

export function useOidcAuth() {
  const [user, setUser] = useState<UserIdentityClaims | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const configRef = useRef(loadOidcConfig());
  const tokensRef = useRef<OidcTokenSet | null>(null);
  const initializedRef = useRef<boolean>(false);

  const applyTokens = useCallback((tokens: OidcTokenSet | null) => {
    tokensRef.current = tokens;
    if (tokens) {
      setInMemoryToken(tokens.accessToken);
      try {
        sessionStorage.setItem('alfheim_access_token', tokens.accessToken);
        sessionStorage.setItem('token_dashboard-frontend', tokens.accessToken);
      } catch {
        /* storage disabled */
      }
      setToken(tokens.accessToken);
      setUser(decodeClaims(tokens.accessToken));
      setIsAuthenticated(true);
    } else {
      setInMemoryToken(null);
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const runRefresh = useCallback(async (): Promise<string | null> => {
    const current = tokensRef.current;
    const refreshed = await refreshTokens(configRef.current, current?.refreshToken ?? null);
    if (refreshed) {
      applyTokens(refreshed);
      return refreshed.accessToken;
    }
    return null;
  }, [applyTokens]);

  const login = useCallback(() => {
    void beginLogin(configRef.current).catch((err) => {
      console.error('Failed to start OIDC login', err);
      setIsLoading(false);
    });
  }, []);

  const logout = useCallback(() => {
    const idToken = tokensRef.current?.idToken ?? null;
    applyTokens(null);
    clearPersistedTokens();
    void endSession(configRef.current, idToken);
  }, [applyTokens]);

  useEffect(() => {
    if (typeof window === 'undefined' || initializedRef.current) return;
    initializedRef.current = true;

    window.__alfheim_oidc__ = {
      getToken: () => tokensRef.current?.accessToken ?? null,
      refresh: runRefresh,
      login,
    };

    (async () => {
      try {
        const exchanged = await completeLoginIfRedirected(configRef.current);
        if (exchanged) {
          applyTokens(exchanged);
          setIsLoading(false);
          return;
        }

        let tokens = loadPersistedTokens();
        if (tokens && tokens.expiresAt - Date.now() < REFRESH_SKEW_MS) {
          tokens = await refreshTokens(configRef.current, tokens.refreshToken);
        }

        if (tokens && tokens.expiresAt > Date.now()) {
          applyTokens(tokens);
          setIsLoading(false);
          return;
        }

        // No usable session: enforce an interactive login redirect.
        clearPersistedTokens();
        login();
      } catch (err) {
        console.error('OIDC authentication initialization failed:', err);
        applyTokens(null);
        setIsLoading(false);
      }
    })();
  }, [applyTokens, login, runRefresh]);

  // Schedule a silent refresh shortly before the current access token expires.
  useEffect(() => {
    if (!isAuthenticated || !tokensRef.current) return;
    const msUntilRefresh = Math.max(
      5_000,
      tokensRef.current.expiresAt - Date.now() - REFRESH_SKEW_MS,
    );
    const timer = window.setTimeout(() => {
      void runRefresh().then((next) => {
        if (!next) logout();
      });
    }, msUntilRefresh);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, token, runRefresh, logout]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    setUser,
    setToken,
    setIsAuthenticated,
  };
}
