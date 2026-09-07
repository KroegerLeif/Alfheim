"use client";

import { useAuth } from "@/core/authContext";
import { AppHeader, useTranslation, resolveFrontendUrl } from "@alfheim/shared";

export function ClientHeader() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <AppHeader
      appName="chores"
      brandTitle="ALFHEIM // CHORES"
      brandSubtitle={t("header.brand_subtitles.chores")}
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
