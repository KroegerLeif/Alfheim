"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ReactNode, useState, useEffect } from "react";
import Keycloak from "keycloak-js";

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const keycloak = new Keycloak({
      url: "http://loeger-os/auth",
      realm: "loeger-os",
      clientId: "shopping-frontend",
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
          sessionStorage.setItem("token_shopping-frontend", keycloak.token || "");

          // Set up token auto-refresh
          const interval = setInterval(() => {
            keycloak.updateToken(70).then((refreshed) => {
              if (refreshed) {
                sessionStorage.setItem("token_shopping-frontend", keycloak.token || "");
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
          {children}
        </SidebarContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

import { createContext, useContext } from "react";

export const SidebarContext = createContext<{
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}>({
  isSidebarOpen: true,
  setIsSidebarOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);
