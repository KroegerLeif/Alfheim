"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import { AuthContext } from "@/core/authContext";
import { UserIdentity, useTranslation } from "@alfheim/shared";

const TOKEN_KEY = "token_chat-frontend";
const SHARED_TOKEN_KEY = "alfheim_access_token";

function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
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
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      })
  );

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<UserIdentity | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    let tokenParam = url.searchParams.get("token") || url.searchParams.get("access_token");

    let cleanNeeded = false;
    ["state", "session_state", "code", "iss", "token", "access_token"].forEach((param) => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        cleanNeeded = true;
      }
    });
    if (cleanNeeded) {
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }

    const storedToken =
      tokenParam ||
      sessionStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(SHARED_TOKEN_KEY);

    if (storedToken) {
      sessionStorage.setItem(TOKEN_KEY, storedToken);
      sessionStorage.setItem(SHARED_TOKEN_KEY, storedToken);
      setToken(storedToken);
      setIsAuthenticated(true);

      const parsed = parseJwt(storedToken);
      if (parsed) {
        setUser({
          name: parsed.name || parsed.preferred_username || "User",
          preferred_username: parsed.preferred_username,
          email: parsed.email,
          given_name: parsed.given_name,
          family_name: parsed.family_name,
        });
      } else {
        setUser({ name: "User" });
      }
    } else {
      setIsAuthenticated(false);
      setAuthError(t("auth.error") || "Authentication required");
    }
  }, [t]);

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SHARED_TOKEN_KEY);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    if (typeof window !== "undefined") {
      window.location.href = window.location.origin;
    }
  };

  if (authError && !isAuthenticated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--surface-canvas)] text-[var(--text-main)] p-6">
        <div className="text-center space-y-4 max-w-md p-6 rounded-2xl glass-card border border-red-500/20">
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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  );
}
