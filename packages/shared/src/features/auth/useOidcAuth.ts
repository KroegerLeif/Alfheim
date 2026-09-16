'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserIdentity } from '@alfheim/shared';
import { OidcConfig, OidcConfigError, OidcTokenSet } from './oidcTypes';
import { loadOidcConfig } from './oidcConfig';
import {
  beginLogin,
  clearPersistedTokens,
  completeLoginIfRedirected,
  decodeClaims,
  endSession,
  loadPersistedTokens,
  refreshTokens,
} from './oidcFlow';
import { isTokenSetValid } from './tokenValidation';

// Refresh (or reject) a persisted token set this many milliseconds before it actually expires.
const REFRESH_SKEW_MS = 60_000;

export interface UseOidcAuthOptions {
  /** The app's Next.js basePath, e.g. "/pantry". Used to build the redirect URI. */
  basePath?: string;
}

export interface OidcAuthState {
  user: UserIdentity | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Set when the runtime OIDC configuration itself is missing (issuer/client id empty). */
  configError: OidcConfigError | null;
  /** Set when discovery or the token exchange failed against a reachable-but-broken issuer. */
  discoveryError: string | null;
  login: () => void;
  logout: () => void;
}

/** Bridge object consumed by API clients for reactive 401 handling. */
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

function claimsToUser(claims: ReturnType<typeof decodeClaims>): UserIdentity | null {
  if (!claims) return null;
  return {
    sub: claims.sub,
    name: claims.name,
    preferred_username: claims.preferred_username,
    email: claims.email,
    given_name: claims.given_name,
    family_name: claims.family_name,
  };
}

export function useOidcAuth(options: UseOidcAuthOptions = {}): OidcAuthState {
  const { basePath = '' } = options;

  const [user, setUser] = useState<UserIdentity | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  let config: OidcConfig | null = null;
  let configError: OidcConfigError | null = null;
  try {
    config = loadOidcConfig(basePath);
  } catch (err) {
    if (err instanceof OidcConfigError) {
      configError = err;
    } else {
      throw err;
    }
  }

  const configRef = useRef<OidcConfig | null>(config);
  configRef.current = config;
  const tokensRef = useRef<OidcTokenSet | null>(null);
  const initializedRef = useRef(false);

  const applyTokens = useCallback((tokens: OidcTokenSet | null) => {
    tokensRef.current = tokens;
    if (tokens) {
      setToken(tokens.accessToken);
      setUser(claimsToUser(decodeClaims(tokens.accessToken)));
      setIsAuthenticated(true);
    } else {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const runRefresh = useCallback(async (): Promise<string | null> => {
    if (!configRef.current) return null;
    const current = tokensRef.current;
    const refreshed = await refreshTokens(configRef.current, current?.refreshToken ?? null);
    if (refreshed) {
      applyTokens(refreshed);
      return refreshed.accessToken;
    }
    return null;
  }, [applyTokens]);

  const login = useCallback(() => {
    if (!configRef.current) return;
    void beginLogin(configRef.current).catch((err) => {
      console.error('Failed to start OIDC login', err);
      setDiscoveryError(err instanceof Error ? err.message : 'Failed to reach the identity provider.');
      setIsLoading(false);
    });
  }, []);

  const logout = useCallback(() => {
    const idToken = tokensRef.current?.idToken ?? null;
    applyTokens(null);
    clearPersistedTokens();
    if (configRef.current) {
      void endSession(configRef.current, idToken);
    }
  }, [applyTokens]);

  useEffect(() => {
    if (typeof window === 'undefined' || initializedRef.current) return;
    if (!configRef.current) {
      // Misconfigured: there is nothing to initialize. AuthGuard renders the error page.
      setIsLoading(false);
      return;
    }
    initializedRef.current = true;
    const activeConfig = configRef.current;

    window.__alfheim_oidc__ = {
      getToken: () => tokensRef.current?.accessToken ?? null,
      refresh: runRefresh,
      login,
    };

    (async () => {
      try {
        const exchanged = await completeLoginIfRedirected(activeConfig);
        if (exchanged) {
          applyTokens(exchanged);
          setIsLoading(false);
          return;
        }

        let tokens = loadPersistedTokens();
        // A session restored from storage is never trusted on expiry alone: it must
        // also carry the currently configured issuer. Refresh once if it is stale
        // or about to expire; a wrong-issuer session is discarded outright below.
        if (tokens && tokens.refreshToken && !isTokenSetValid(tokens, activeConfig.issuer, REFRESH_SKEW_MS)) {
          tokens = await refreshTokens(activeConfig, tokens.refreshToken);
        }

        if (tokens && isTokenSetValid(tokens, activeConfig.issuer)) {
          applyTokens(tokens);
          setIsLoading(false);
          return;
        }

        // No usable, validated session: enforce an interactive login redirect.
        clearPersistedTokens();
        login();
      } catch (err) {
        console.error('OIDC authentication initialization failed:', err);
        setDiscoveryError(err instanceof Error ? err.message : 'Failed to reach the identity provider.');
        applyTokens(null);
        setIsLoading(false);
      }
    })();
  }, [applyTokens, login, runRefresh]);

  // Schedule a silent refresh shortly before the current access token expires.
  useEffect(() => {
    if (!isAuthenticated || !tokensRef.current) return;
    const msUntilRefresh = Math.max(5_000, tokensRef.current.expiresAt - Date.now() - REFRESH_SKEW_MS);
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
    configError,
    discoveryError,
    login,
    logout,
  };
}
