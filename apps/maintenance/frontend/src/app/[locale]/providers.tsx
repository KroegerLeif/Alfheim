"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { LayoutProvider } from "@/shared/layout/LayoutContext";
import { AuthContext } from "@/core/auth/AuthContext";
import { useMaintenanceKeycloak } from "@/core/auth/useMaintenanceKeycloak";
import { useTranslation } from "@alfheim/shared";

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

  const { isAuthenticated, authError, user, token, handleLogout } = useMaintenanceKeycloak();

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
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent mx-auto"></div>
          <p className="text-lg font-medium tracking-wide">{t("auth.securing_session")}</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, logout: handleLogout }}>
      <QueryClientProvider client={queryClient}>
        <LayoutProvider>{children}</LayoutProvider>
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}
