"use client";

import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { AppHeader, resolveFrontendUrl } from "@alfheim/shared";
import { useSidebar } from "@/app/[locale]/providers";
import { useAuth } from "@/core/auth/AuthContext";

/**
 * Sticky top application bar utilizing the unified @alfheim/shared AppHeader.
 */
export function Header() {
  const tNav = useTranslations("Navigation");
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const { user, logout } = useAuth();

  return (
    <AppHeader
      appName="shopping"
      brandTitle="ALFHEIM // SHOPPING"
      brandSubtitle={tNav("subtitle") || "Smart Grocery List"}
      showBackToDashboard={true}
      backToDashboardHref={resolveFrontendUrl()}
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
      user={user}
      onLogout={logout}
    />
  );
}
