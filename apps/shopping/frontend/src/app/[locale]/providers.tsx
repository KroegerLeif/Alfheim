"use client";

import type { ReactNode } from "react";
import { AppProviders } from "@alfheim/shared/app-shell";
import { NotificationsProvider } from "@/components/shared/Notifications";
import { ShellStateProvider } from "@/components/shared/ShellState";

/** Shared app providers with the shopping theme, shell state and notifications. */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProviders theme={{ defaultMode: "dark", defaultVariant: "obsidian" }}>
      <ShellStateProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </ShellStateProvider>
    </AppProviders>
  );
}
