"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect, useRef } from "react";
import Keycloak, { KeycloakTokenParsed } from "keycloak-js";
import { AuthContext } from "@/core/authContext";
import { UserIdentity, useTranslation } from "@alfheim/shared";

interface ExtendedTokenParsed extends KeycloakTokenParsed {
  name?: string;
  preferred_username?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
}

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
    if (!initializedRef.current) {
      initializedRef.current = true;

      const keycloak = new Keycloak({
        url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://api.alfheim.loegien.localhost/auth",
        realm: "alfheim",
        clientId: "library-frontend",
      });

      setKeycloakInstance(keycloak);

      const cleanQueryParams = () => {
        if (typeof window !== "undefined") {
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
            const currentToken = keycloak.token || "";
            setToken(currentToken);
            sessionStorage.setItem("token_library-frontend", currentToken);
            sessionStorage.setItem("alfheim_access_token", currentToken);

            if (keycloak.tokenParsed) {
              const parsed = keycloak.tokenParsed as ExtendedTokenParsed;
              setUser({
                name: parsed.name || parsed.preferred_username || "User",
                preferred_username: parsed.preferred_username,
                email: parsed.email,
                given_name: parsed.given_name,
                family_name: parsed.family_name,
              });
            }

            refreshIntervalRef.current = setInterval(() => {
              keycloak.updateToken(70).then((refreshed) => {
                if (refreshed && keycloak.token) {
                  const refreshedToken = keycloak.token || "";
                  setToken(refreshedToken);
                  sessionStorage.setItem("token_library-frontend", refreshedToken);
                  sessionStorage.setItem("alfheim_access_token", refreshedToken);
                }
              }).catch(() => {
                console.error("Failed to refresh Keycloak token");
              });
            }, 60000);
          } else {
            setIsAuthenticated(false);
          }
        })
        .catch((err) => {
          console.error("Keycloak initialization failed", err);
          cleanQueryParams();
          if (isMounted) {
            setAuthError("Failed to connect to Keycloak auth service.");
          }
        });
    }

    return () => {
      isMounted = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  const handleLogout = () => {
    if (keycloakInstance) {
      sessionStorage.removeItem("token_library-frontend");
      sessionStorage.removeItem("alfheim_access_token");
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      keycloakInstance.logout({
        redirectUri: window.location.origin + "/library/en"
      });
    }
  };

  if (authError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--surface-canvas)] text-[var(--text-main)] p-6">
        <div className="text-center space-y-4 max-w-md p-6 rounded-2xl border border-red-500/20">
          <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold">{t("auth.error")}</h2>
          <p className="text-sm text-[var(--text-muted)]">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
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
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary-main)] border-t-transparent mx-auto"></div>
          <p className="text-lg font-medium tracking-wide">{t("auth.securing_session")}</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, logout: handleLogout }}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}
