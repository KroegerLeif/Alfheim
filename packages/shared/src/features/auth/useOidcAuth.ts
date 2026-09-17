'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserIdentity } from '@alfheim/shared';
import { InsecureContextError, IssuerUnreachableError, OidcConfig, OidcConfigError, OidcTokenSet } from './oidcTypes';
import { loadOidcConfig } from './oidcConfig';
import {
  beginLogin,
  clearPersistedTokens,
  completeLoginIfRedirected,
  decodeClaims,
  detectInsecureContext,
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
  /** Set when the page is served outside a Secure Context (plain HTTP), so login cannot run. */
  insecureContextError: InsecureContextError | null;
  /**
   * Set when discovery could not connect to an HTTPS issuer on another host (often an
   * untrusted private-CA certificate for that host, or the IdP being down).
   */
  issuerUnreachableError: IssuerUnreachableError | null;
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
  // Config is intentionally NOT resolved during render: the server has no
  // window.__ALFHEIM_ENV__ and no NEXT_PUBLIC_OIDC_* build-time fallback, so
  // resolving it synchronously would make the very first server- and
  // client-render show the misconfiguration error page (and mismatch on
  // hydration once the client re-checks and finds runtime env has loaded).
  // Instead every render before mount reports "still loading", identical on
  // the server and the client's first paint, and the config (or its error)
  // is only established from an effect after mount.
  const [configError, setConfigError] = useState<OidcConfigError | null>(null);
  const [insecureContextError, setInsecureContextError] = useState<InsecureContextError | null>(null);
  const [issuerUnreachableError, setIssuerUnreachableError] = useState<IssuerUnreachableError | null>(null);

  const configRef = useRef<OidcConfig | null>(null);
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
      if (err instanceof InsecureContextError) {
        setInsecureContextError(err);
        setIsLoading(false);
        return;
      }
      if (err instanceof IssuerUnreachableError) {
        console.error('Failed to start OIDC login', err);
        setIssuerUnreachableError(err);
        setIsLoading(false);
        return;
      }
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
    initializedRef.current = true;

    let activeConfig: OidcConfig;
    try {
      activeConfig = loadOidcConfig(basePath);
    } catch (err) {
      if (err instanceof OidcConfigError) {
        // Misconfigured: there is nothing to initialize. AuthGuard renders the error page.
        setConfigError(err);
        setIsLoading(false);
        return;
      }
      throw err;
    }
    configRef.current = activeConfig;

    // Detect a missing Secure Context up front, so the operator is told how to fix it
    // instead of seeing a spinner followed by a cryptic "reading 'digest'" TypeError.
    const insecure = detectInsecureContext();
    if (insecure) {
      setInsecureContextError(insecure);
      setIsLoading(false);
      return;
    }

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
        if (err instanceof IssuerUnreachableError) {
          setIssuerUnreachableError(err);
          applyTokens(null);
          setIsLoading(false);
          return;
        }
        setDiscoveryError(err instanceof Error ? err.message : 'Failed to reach the identity provider.');
        applyTokens(null);
        setIsLoading(false);
      }
    })();
  }, [applyTokens, login, runRefresh, basePath]);

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
    insecureContextError,
    issuerUnreachableError,
    login,
    logout,
  };
}
