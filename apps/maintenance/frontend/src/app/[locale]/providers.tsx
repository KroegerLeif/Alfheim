"use client";

import type { ReactNode } from "react";
import { AppProviders } from "@alfheim/shared/app-shell";
import { LayoutProvider } from "@/shared/layout/LayoutContext";

/** Shared app providers plus the maintenance layout state. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <LayoutProvider>{children}</LayoutProvider>
    </AppProviders>
  );
}
