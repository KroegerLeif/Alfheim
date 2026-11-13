"use client";

import type { ReactNode } from "react";
import { AppProviders } from "@alfheim/shared/app-shell";

/** Shared app providers with the budget theme defaults. */
export default function Providers({ children }: { children: ReactNode }) {
  return <AppProviders theme={{ defaultMode: "dark", defaultVariant: "nordic" }}>{children}</AppProviders>;
}
