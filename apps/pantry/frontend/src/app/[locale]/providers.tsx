"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect, useRef } from "react";
import Keycloak from "keycloak-js";
import { AuthContext } from "@/core/authContext";
import { UserIdentity } from "@alfheim/shared";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 minutes
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const keycloak = new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://api.alfheim.loegien.localhost/auth",
      realm: "alfheim",
      clientId: "pantry-frontend",
    });

    setKeycloakInstance(keycloak);
    (window as any).__keycloak_instance__ = keycloak;

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
        if (authenticated && keycloak.token) {
          setIsAuthenticated(true);
          const currentToken = keycloak.token || "";
          setToken(currentToken);
          sessionStorage.setItem("token_pantry-frontend", currentToken);
          sessionStorage.setItem("alfheim_access_token", currentToken);

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

          const interval = setInterval(() => {
            keycloak.updateToken(70).then((refreshed) => {
              if (refreshed && keycloak.token) {
                const refreshedToken = keycloak.token || "";
                setToken(refreshedToken);
                sessionStorage.setItem("token_pantry-frontend", refreshedToken);
                sessionStorage.setItem("alfheim_access_token", refreshedToken);
              }
            }).catch(() => {
              console.error("Failed to refresh Keycloak token");
            });
          }, 60000);

          return () => clearInterval(interval);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch((err) => {
        console.error("Keycloak initialization failed", err);
        cleanQueryParams();
        setAuthError("Failed to connect to Keycloak auth service.");
      });
  }, []);

  const handleLogout = () => {
    if (keycloakInstance) {
      sessionStorage.removeItem("token_pantry-frontend");
      sessionStorage.removeItem("alfheim_access_token");
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      keycloakInstance.logout({
        redirectUri: window.location.origin + "/pantry/en"
      });
    }
  };

  if (authError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--surface-canvas)] text-[var(--text-main)] p-6">
        <div className="text-center space-y-4 max-w-md p-6 rounded-2xl glass-card border border-red-500/20">
          <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold">Authentication Error</h2>
          <p className="text-sm text-[var(--text-muted)]">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Retry Connection
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
          <p className="text-lg font-medium tracking-wide">Securing session with Keycloak...</p>
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

