"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as SharedThemeProvider, useTranslation } from "@alfheim/shared";
import { ReactNode, useState, useEffect, useRef, createContext, useContext } from "react";
import Keycloak from "keycloak-js";

export const SidebarContext = createContext<{
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}>({
  isSidebarOpen: true,
  setIsSidebarOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export const ActiveListContext = createContext<{
  activeListId: string | null;
  setActiveListId: (id: string | null) => void;
}>({
  activeListId: null,
  setActiveListId: () => {},
});

export const useActiveList = () => useContext(ActiveListContext);

export default function Providers({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeListId, setActiveListId] = useState<string | null>(null);
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
        clientId: "shopping-frontend",
      });

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
            (window as any).__keycloak_instance__ = keycloak;
            sessionStorage.setItem("token_shopping-frontend", keycloak.token || "");
            sessionStorage.setItem("alfheim_access_token", keycloak.token || "");

            // Set up token auto-refresh
            refreshIntervalRef.current = setInterval(() => {
              keycloak
                .updateToken(70)
                .then((refreshed) => {
                  if (refreshed && keycloak.token) {
                    sessionStorage.setItem(
                      "token_shopping-frontend",
                      keycloak.token || ""
                    );
                    sessionStorage.setItem(
                      "alfheim_access_token",
                      keycloak.token || ""
                    );
                  }
                })
                .catch(() => {
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

  if (authError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground p-6">
        <div className="text-center space-y-4 max-w-md p-6 rounded-2xl glass-card border border-red-500/20">
          <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold">{t("auth.error")}</h2>
          <p className="text-sm text-muted-foreground">{authError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            {t("auth.retry_connection")}
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-lg font-medium tracking-wide">{t("auth.securing_session")}</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SharedThemeProvider defaultMode="dark" defaultVariant="obsidian">
        <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
          <ActiveListContext.Provider value={{ activeListId, setActiveListId }}>
            {children}
          </ActiveListContext.Provider>
        </SidebarContext.Provider>
      </SharedThemeProvider>
    </QueryClientProvider>
  );
}
