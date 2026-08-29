"use client";

import { AppHeader, useTranslation } from "@alfheim/shared";
import { useAuth } from "@/core/authContext";

export function ClientHeader() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <AppHeader
      appName="workout"
      brandTitle="ALFHEIM // WORKOUT"
      brandSubtitle={t("header.brand_subtitles.workout")}
      showBackToDashboard={true}
      backToDashboardHref={process.env.NEXT_PUBLIC_FRONTEND_URL || "/"}
      showHouseholdSwitcher={true}
      showLanguageSwitcher={true}
      showThemeToggle={true}
      showAuthControls={true}
      user={user}
      onLogout={logout}
    />
  );
}
