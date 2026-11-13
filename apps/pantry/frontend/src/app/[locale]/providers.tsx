"use client";

import type { ReactNode } from "react";
import { AppProviders } from "@alfheim/shared/app-shell";
import { PantryChatProvider } from "@/core/chatContext";
import { PantryChatOverlay } from "@/components/shared/PantryChatOverlay";

/** Shared app providers plus the pantry chat overlay. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <PantryChatProvider>
        {children}
        <PantryChatOverlay />
      </PantryChatProvider>
    </AppProviders>
  );
}
