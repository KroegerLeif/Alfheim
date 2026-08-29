"use client";

import { useAuth } from "@/core/authContext";
import { usePantryChat } from "@/core/chatContext";
import { AlfiAvatar, AppHeader, useTranslation } from "@alfheim/shared";

export function ClientHeader() {
  const { user, logout } = useAuth();
  const { toggleChat } = usePantryChat();
  const { t } = useTranslation();

  return (
    <AppHeader
      appName="pantry"
      brandTitle="ALFHEIM // PANTRY"
      brandSubtitle={t("header.brand_subtitles.pantry")}
      showBackToDashboard={true}
      backToDashboardHref={process.env.NEXT_PUBLIC_FRONTEND_URL || "http://alfheim.loegien.localhost"}
      showHouseholdSwitcher={true}
      showLanguageSwitcher={true}
      showThemeToggle={true}
      showAuthControls={true}
      user={user}
      onLogout={logout}
      actionsSlot={
        <button
          type="button"
          onClick={toggleChat}
          aria-label={t("pantry.askAlfi")}
          title={t("pantry.askAlfi")}
          className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--primary-main)] hover:bg-[var(--surface-canvas)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]"
        >
          <AlfiAvatar status="idle" size="sm" />
          <span className="hidden sm:inline">ALFI</span>
        </button>
      }
    />
  );
}
