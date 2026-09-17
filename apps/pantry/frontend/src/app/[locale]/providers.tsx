"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { PantryChatProvider } from "@/core/chatContext";
import { PantryChatOverlay } from "@/components/shared/PantryChatOverlay";

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

  return (
    <QueryClientProvider client={queryClient}>
      <PantryChatProvider>
        {children}
        <PantryChatOverlay />
      </PantryChatProvider>
    </QueryClientProvider>
  );
}
