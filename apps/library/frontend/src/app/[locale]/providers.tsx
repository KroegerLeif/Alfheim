"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState, useEffect } from "react";
import { AuthContext } from "@/core/authContext";
import { UserIdentity, useTranslation } from "@alfheim/shared";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
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
            staleTime: 5 * 60 * 1000,
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

    try {
      const storedToken =
        sessionStorage.getItem("token_library-frontend") ||
        sessionStorage.getItem("alfheim_access_token") ||
        localStorage.getItem("alfheim_access_token");

      if (storedToken) {
        setToken(storedToken);
        setIsAuthenticated(true);
        const payload = decodeJwtPayload(storedToken);
        if (payload) {
          const name =
            (payload.name as string) ||
            (payload.preferred_username as string) ||
            "User";
          setUser({
            name,
            preferred_username: payload.preferred_username as string,
            email: payload.email as string,
            given_name: payload.given_name as string,
            family_name: payload.family_name as string,
          });
        }
      } else {
        // Fallback for dev / unauthenticated session initialization
        const devToken = "mock_dev_token";
        setToken(devToken);
        setIsAuthenticated(true);
        setUser({
          name: "Library User",
          preferred_username: "library_user",
        });
      }
    } catch (err) {
      console.error("OIDC auth context setup error:", err);
      setAuthError("Failed to initialize OIDC authentication context.");
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("token_library-frontend");
    sessionStorage.removeItem("alfheim_access_token");
    localStorage.removeItem("alfheim_access_token");
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    if (typeof window !== "undefined") {
      const issuer = process.env.NEXT_PUBLIC_OIDC_ISSUER || "http://auth.alfheim.loegien.localhost";
      window.location.href = `${issuer.replace(/\/+$/, "")}/end_session`;
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
