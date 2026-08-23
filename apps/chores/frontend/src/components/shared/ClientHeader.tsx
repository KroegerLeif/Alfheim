"use client";

import { useAuth } from "@/core/authContext";
import { AppHeader, useTranslation } from "@alfheim/shared";

export function ClientHeader() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <AppHeader
      appName="chores"
      brandTitle="ALFHEIM // CHORES"
      brandSubtitle={t("header.brand_subtitles.chores")}
      showBackToDashboard={true}
      backToDashboardHref={process.env.NEXT_PUBLIC_FRONTEND_URL || "http://alfheim.loegien.localhost"}
      showHouseholdSwitcher={true}
      showLanguageSwitcher={true}
      showThemeToggle={true}
      showAuthControls={true}
      user={user}
      onLogout={logout}
    />
  );
}
