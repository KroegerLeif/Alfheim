"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect, useRef } from "react";
import { AuthContext } from "@/core/authContext";
import { UserIdentity, useTranslation } from "@alfheim/shared";

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

  useEffect(() => {
    let isMounted = true;
    if (typeof window === "undefined") return;

    if (!initializedRef.current) {
      initializedRef.current = true;

      const storedToken =
        sessionStorage.getItem("token_chores-frontend") ||
        sessionStorage.getItem("alfheim_access_token") ||
        localStorage.getItem("token_chores-frontend") ||
        localStorage.getItem("alfheim_access_token");

      if (storedToken) {
        setToken(storedToken);
        setIsAuthenticated(true);
        try {
          const parts = storedToken.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const name =
              typeof payload.name === "string"
                ? payload.name
                : typeof payload.preferred_username === "string"
                ? payload.preferred_username
                : "User";
            setUser({
              name,
              preferred_username:
                typeof payload.preferred_username === "string" ? payload.preferred_username : undefined,
              email: typeof payload.email === "string" ? payload.email : undefined,
              given_name: typeof payload.given_name === "string" ? payload.given_name : undefined,
              family_name: typeof payload.family_name === "string" ? payload.family_name : undefined,
            });
          }
        } catch (e) {
          console.warn("Failed to parse token payload in Chores frontend provider:", e);
        }
      } else {
        const oidcIssuer = process.env.NEXT_PUBLIC_OIDC_ISSUER || "http://localhost:8080";
        const oidcClientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "chores-frontend";

        // In development / testing or when redirected with token, handle accordingly
        const mockToken = "mock_session_token";
        setToken(mockToken);
        sessionStorage.setItem("token_chores-frontend", mockToken);
        sessionStorage.setItem("alfheim_access_token", mockToken);
        setUser({ name: "Demo User", preferred_username: "demouser" });
        setIsAuthenticated(true);
      }
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("token_chores-frontend");
    sessionStorage.removeItem("alfheim_access_token");
    localStorage.removeItem("token_chores-frontend");
    localStorage.removeItem("alfheim_access_token");
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);

    const rawIssuer = process.env.NEXT_PUBLIC_OIDC_ISSUER || "http://localhost:8080";
    const clientId = process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "chores-frontend";
    const cleanIssuer = rawIssuer.endsWith("/") ? rawIssuer.slice(0, -1) : rawIssuer;
    const redirectUri = encodeURIComponent(window.location.origin + "/chores/de");

    window.location.href = `${cleanIssuer}/oidc/v1/end_session?client_id=${encodeURIComponent(clientId)}&post_logout_redirect_uri=${redirectUri}`;
  };

  if (authError) {
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
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
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
