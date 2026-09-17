"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider as SharedThemeProvider } from "@alfheim/shared";
import { ReactNode, useState, createContext, useContext } from "react";

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

/**
 * Non-auth application providers. Authentication (OIDC session validation,
 * login redirect, misconfiguration/discovery error pages) is handled by the
 * shared AuthGuard wrapping this component in the locale layout.
 */
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeListId, setActiveListId] = useState<string | null>(null);

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
