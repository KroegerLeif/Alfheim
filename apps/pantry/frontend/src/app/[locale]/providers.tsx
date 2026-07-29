"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import Keycloak from "keycloak-js";
import { AuthContext } from "@/lib/authContext";
import { UserIdentity } from "@loeger-os/shared";

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
  const [user, setUser] = useState<UserIdentity | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [keycloakInstance, setKeycloakInstance] = useState<Keycloak | null>(null);

  useEffect(() => {
    // Only run Keycloak initialization in the browser context
    if (typeof window === "undefined") return;

    const keycloak = new Keycloak({
      url: "http://loeger-os/auth",
      realm: "loeger-os",
      clientId: "pantry-frontend",
    });

    keycloak
      .init({
        onLoad: "login-required",
        checkLoginIframe: false,
        pkceMethod: "S256",
      })
      .then((authenticated) => {
        if (authenticated) {
          setIsAuthenticated(true);
          setKeycloakInstance(keycloak);
          const currentToken = keycloak.token || "";
          setToken(currentToken);
          sessionStorage.setItem("token_pantry-frontend", currentToken);

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

          // Set up token auto-refresh
          const interval = setInterval(() => {
            keycloak.updateToken(70).then((refreshed) => {
              if (refreshed) {
                const refreshedToken = keycloak.token || "";
                setToken(refreshedToken);
                sessionStorage.setItem("token_pantry-frontend", refreshedToken);
              }
            }).catch(() => {
              console.error("Failed to refresh Keycloak token");
            });
          }, 60000);

          return () => clearInterval(interval);
        }
      })
      .catch((err) => {
        console.error("Keycloak initialization failed", err);
      });
  }, []);

  const handleLogout = () => {
    if (keycloakInstance) {
      keycloakInstance.logout();
    }
  };

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

