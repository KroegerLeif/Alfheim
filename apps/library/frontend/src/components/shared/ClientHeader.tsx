"use client";

import { useAuth } from "@/core/authContext";
import { AppHeader, useTranslation, resolveFrontendUrl } from "@alfheim/shared";

export function ClientHeader() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <AppHeader
      appName="library"
      brandTitle="ALFHEIM // LIBRARY"
      brandSubtitle={t("header.brand_subtitles.library")}
      showBackToDashboard={true}
      backToDashboardHref={resolveFrontendUrl()}
      showHouseholdSwitcher={true}
      showLanguageSwitcher={true}
      showThemeToggle={true}
      showAuthControls={true}
      user={user}
      onLogout={logout}
    />
  );
}
