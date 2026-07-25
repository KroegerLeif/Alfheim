"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ReactNode, useState, useEffect, useCallback } from "react";
import Keycloak from "keycloak-js";
import { LayoutProvider } from "@/shared/layout/LayoutContext";
import { AuthContext, UserProfile } from "@/shared/auth/AuthContext";

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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [keycloakInstance, setKeycloakInstance] = useState<Keycloak | null>(null);

  const extractUserProfile = useCallback((keycloak: Keycloak): UserProfile => {
    const tokenParsed = keycloak.tokenParsed as Record<string, any> | undefined;
    const name =
      tokenParsed?.name ||
      tokenParsed?.preferred_username ||
      tokenParsed?.email ||
      "Maintenance User";
    const username = tokenParsed?.preferred_username || name;
    const email = tokenParsed?.email;

    const roles: string[] = tokenParsed?.realm_access?.roles || [];
    const role = roles.includes("admin")
      ? "Administrator"
      : "Maintenance Technician";

    const initials =
      name
        .split(" ")
        .filter(Boolean)
        .map((part: string) => part[0].toUpperCase())
        .slice(0, 2)
        .join("") || "MU";

    return {
      name,
      username,
      email,
      role,
      initials,
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const keycloak = new Keycloak({
      url: "http://loeger-os/auth",
      realm: "loeger-os",
      clientId: "maintenance-frontend",
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
          sessionStorage.setItem("token_maintenance-frontend", currentToken);
          setUser(extractUserProfile(keycloak));

          // Set up token auto-refresh
          const interval = setInterval(() => {
            keycloak
              .updateToken(70)
              .then((refreshed) => {
                if (refreshed) {
                  const newToken = keycloak.token || "";
                  setToken(newToken);
                  sessionStorage.setItem("token_maintenance-frontend", newToken);
                  setUser(extractUserProfile(keycloak));
                }
              })
              .catch(() => {
                console.error("Failed to refresh Keycloak token");
              });
          }, 60000);

          return () => clearInterval(interval);
        }
      })
      .catch((err) => {
        console.error("Keycloak initialization failed", err);
      });
  }, [extractUserProfile]);

  const handleLogout = useCallback(() => {
    if (keycloakInstance) {
      sessionStorage.removeItem("token_maintenance-frontend");
      keycloakInstance.logout();
    }
  }, [keycloakInstance]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mx-auto"></div>
          <p className="text-lg font-medium tracking-wide">Securing session with Keycloak...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, logout: handleLogout }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LayoutProvider>{children}</LayoutProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}
