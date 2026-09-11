"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserIdentity } from "@alfheim/shared";
import {
  clearPersistedTokens,
  decodeClaims,
  loadOidcConfig,
  loadPersistedTokens,
  type OidcTokenSet,
} from "./oidcConfig";
import {
  beginLogin,
  completeLoginIfRedirected,
  endSession,
  refreshTokens,
} from "./oidcFlow";

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

const REFRESH_SKEW_MS = 60_000;

export function useOidcAuth() {
  const [user, setUser] = useState<UserIdentity | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const configRef = useRef(loadOidcConfig());
  const tokensRef = useRef<OidcTokenSet | null>(null);
  const initializedRef = useRef<boolean>(false);

  const applyTokens = useCallback((tokens: OidcTokenSet | null) => {
    tokensRef.current = tokens;
    if (tokens) {
      try {
        sessionStorage.setItem("alfheim_access_token", tokens.accessToken);
        sessionStorage.setItem("token_maintenance-frontend", tokens.accessToken);
      } catch {
        /* storage disabled */
      }
      setToken(tokens.accessToken);
      const claims = decodeClaims(tokens.accessToken);
      if (claims) {
        setUser({
          name: claims.name || claims.preferred_username || "User",
          preferred_username: claims.preferred_username,
          email: claims.email,
          given_name: claims.given_name,
          family_name: claims.family_name,
        });
      } else {
        setUser(null);
      }
      setIsAuthenticated(true);
    } else {
      try {
        sessionStorage.removeItem("token_maintenance-frontend");
        sessionStorage.removeItem("alfheim_access_token");
      } catch {
        /* ignore */
      }
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
      console.error("Failed to start OIDC login", err);
      setAuthError("Failed to connect to OIDC authentication service.");
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
    if (typeof window === "undefined" || initializedRef.current) return;
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

        clearPersistedTokens();
        login();
      } catch (err) {
        console.error("OIDC authentication initialization failed:", err);
        setAuthError("Failed to connect to OIDC authentication service.");
        applyTokens(null);
        setIsLoading(false);
      }
    })();
  }, [applyTokens, login, runRefresh]);

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
    authError,
    login,
    logout,
  };
}
