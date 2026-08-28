"use client";

import { useAuth } from "@/core/authContext";
import { AppHeader, useTranslation } from "@alfheim/shared";

export function ClientHeader() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <AppHeader
      appName="library"
      brandTitle="ALFHEIM // LIBRARY"
      brandSubtitle={t("header.brand_subtitles.library")}
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
