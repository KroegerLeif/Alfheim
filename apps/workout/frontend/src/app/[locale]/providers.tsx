"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { AuthContext } from "@/core/authContext";
import { Spinner, UserIdentity, useTranslation } from "@alfheim/shared";
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
} from "@/core/oidc";

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

export default function Providers({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60 * 1000,
          },
        },
      })
  );

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<UserIdentity | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const configRef = useRef(loadOidcConfig());
  const tokensRef = useRef<OidcTokenSet | null>(null);

  const applyTokens = useCallback((tokens: OidcTokenSet | null) => {
    tokensRef.current = tokens;
    if (tokens) {
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
      }
      setIsAuthenticated(true);
    } else {
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

  const handleLogin = useCallback(() => {
    void beginLogin(configRef.current).catch((err) => {
      console.error("Failed to start OIDC login", err);
      setAuthError(t("auth.error"));
    });
  }, [t]);

  const handleLogout = useCallback(() => {
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
      login: handleLogin,
    };

    (async () => {
      try {
        const exchanged = await completeLoginIfRedirected(configRef.current);
        if (exchanged) {
          applyTokens(exchanged);
          return;
        }

        let tokens = loadPersistedTokens();
        if (tokens && tokens.expiresAt - Date.now() < REFRESH_SKEW_MS) {
          tokens = await refreshTokens(configRef.current, tokens.refreshToken);
        }

        if (tokens && tokens.expiresAt > Date.now()) {
          applyTokens(tokens);
          return;
        }

        clearPersistedTokens();
        handleLogin();
      } catch (err) {
        console.error("OIDC authentication initialization failed:", err);
        setAuthError(t("auth.error"));
      }
    })();
  }, [applyTokens, handleLogin, runRefresh, t]);

  useEffect(() => {
    if (!isAuthenticated || !tokensRef.current) return;
    const msUntilRefresh = Math.max(
      5_000,
      tokensRef.current.expiresAt - Date.now() - REFRESH_SKEW_MS
    );
    const timer = window.setTimeout(() => {
      void runRefresh().then((next) => {
        if (!next) handleLogout();
      });
    }, msUntilRefresh);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, token, runRefresh, handleLogout]);

  if (authError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--surface-canvas)] p-6 text-[var(--text-main)]">
        <div className="max-w-md space-y-4 rounded-2xl border border-red-500/20 p-6 text-center">
          <div
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-xl font-bold text-red-400"
          >
            !
          </div>
          <h2 className="text-lg font-bold">{t("auth.error")}</h2>
          <p className="text-sm text-[var(--text-muted)]">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="min-h-11 cursor-pointer rounded-xl bg-[var(--primary-main)] px-4 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-[var(--primary-hover)]"
          >
            {t("auth.retry_connection")}
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--surface-canvas)] text-[var(--text-main)]">
        <div className="space-y-4 text-center">
          <Spinner size="lg" label={t("auth.securing_session")} className="mx-auto" />
          <p aria-hidden="true" className="text-lg font-medium tracking-wide">
            {t("auth.securing_session")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, logout: handleLogout }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  );
}
