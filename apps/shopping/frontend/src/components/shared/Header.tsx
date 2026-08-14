"use client";

import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { AppHeader } from "@alfheim/shared";
import { useSidebar } from "@/app/[locale]/providers";
import { useKeycloakUser } from "@/lib/useKeycloakUser";

/**
 * Sticky top application bar utilizing the unified @alfheim/shared AppHeader.
 */
export function Header() {
  const tNav = useTranslations("Navigation");
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const user = useKeycloakUser();

  const authUser = user ? {
    name: user.name,
    preferred_username: user.username,
    email: user.email,
  } : null;

  return (
    <AppHeader
      appName="shopping"
      brandTitle="ALFHEIM // SHOPPING"
      brandSubtitle={tNav("subtitle") || "Smart Grocery List"}
      showBackToDashboard={true}
      backToDashboardHref={process.env.NEXT_PUBLIC_FRONTEND_URL || "http://alfheim.loegien.localhost"}
      leftSlot={
        !isSidebarOpen ? (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 rounded-lg bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer transition-colors"
            aria-label={tNav("expandSidebar")}
            title={tNav("expandSidebar")}
          >
            <Menu className="h-4 w-4" />
          </button>
        ) : undefined
      }
      user={authUser}
      onLogout={user.logout}
    />
  );
}
