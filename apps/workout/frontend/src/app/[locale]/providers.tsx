"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect, useRef } from "react";
import Keycloak from "keycloak-js";
import { AuthContext } from "@/core/authContext";
import { Spinner, UserIdentity, useTranslation } from "@alfheim/shared";

const TOKEN_KEY = "token_workout-frontend";
const SHARED_TOKEN_KEY = "alfheim_access_token";

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
  const [keycloakInstance, setKeycloakInstance] = useState<Keycloak | null>(null);
  const initializedRef = useRef(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (typeof window === "undefined") return;
    // React 18+ strict mode mounts effects twice; Keycloak must init only once.
    if (initializedRef.current) return;
    initializedRef.current = true;

    const keycloak = new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://api.alfheim.loegien.localhost/auth",
      realm: "alfheim",
      clientId: "workout-frontend",
    });

    setKeycloakInstance(keycloak);
    // Exposed so the ky afterResponse hook can refresh the token on a 401.
    (window as any).__keycloak_instance__ = keycloak;

    const persistToken = (value: string) => {
      sessionStorage.setItem(TOKEN_KEY, value);
      sessionStorage.setItem(SHARED_TOKEN_KEY, value);
    };

    const cleanQueryParams = () => {
      const url = new URL(window.location.href);
      let hasParams = false;
      ["state", "session_state", "code", "iss"].forEach((param) => {
        if (url.searchParams.has(param)) {
          url.searchParams.delete(param);
          hasParams = true;
        }
      });
      if (hasParams) {
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    };

    keycloak
      .init({
        onLoad: "login-required",
        checkLoginIframe: false,
        pkceMethod: "S256",
        responseMode: "query",
      })
      .then((authenticated) => {
        cleanQueryParams();
        if (!isMounted) return;

        if (authenticated && keycloak.token) {
          setIsAuthenticated(true);
          setToken(keycloak.token);
          persistToken(keycloak.token);

          if (keycloak.tokenParsed) {
            const parsed = keycloak.tokenParsed as any;
            setUser({
              name: parsed.name || parsed.preferred_username || "User",
              preferred_username: parsed.preferred_username,
              email: parsed.email,
              given_name: parsed.given_name,
              family_name: parsed.family_name,
            });
          }

          refreshIntervalRef.current = setInterval(() => {
            keycloak
              .updateToken(70)
              .then((refreshed) => {
                if (refreshed && keycloak.token) {
                  setToken(keycloak.token);
                  persistToken(keycloak.token);
                }
              })
              .catch(() => console.error("Failed to refresh Keycloak token"));
          }, 60000);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch((err) => {
        console.error("Keycloak initialization failed", err);
        cleanQueryParams();
        if (isMounted) {
          setAuthError(t("auth.error"));
        }
      });

    return () => {
      isMounted = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [t]);

  const handleLogout = () => {
    if (!keycloakInstance) return;
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SHARED_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    keycloakInstance.logout({
      redirectUri: window.location.origin + "/workout/de",
    });
  };

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
          {/* aria-hidden: the Spinner's status region already announces this text. */}
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
