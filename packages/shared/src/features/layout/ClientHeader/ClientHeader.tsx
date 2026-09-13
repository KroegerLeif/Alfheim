"use client";

import { AppHeader, useTranslation, resolveFrontendUrl } from "@alfheim/shared";
import { useAuth } from "../../auth/authContext";

export interface ClientHeaderProps {
  appName: string;
  brandTitle?: string;
  brandSubtitle?: string;
  actionsSlot?: React.ReactNode;
}

export function ClientHeader({
  appName,
  brandTitle,
  brandSubtitle,
  actionsSlot,
}: ClientHeaderProps) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <AppHeader
      appName={appName as any}
      brandTitle={brandTitle}
      brandSubtitle={brandSubtitle || t(`header.brand_subtitles.${appName}`)}
      showBackToDashboard={true}
      backToDashboardHref={resolveFrontendUrl()}
      showHouseholdSwitcher={true}
      showLanguageSwitcher={true}
      showThemeToggle={true}
      showAuthControls={true}
      user={user}
      onLogout={logout}
      actionsSlot={actionsSlot}
    />
  );
}
