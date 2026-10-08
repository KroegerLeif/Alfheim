"use client";

import { AppHeader } from "../Header/AppHeader";
import { useTranslation } from "../../i18n/utils/useTranslation";
import { resolveFrontendUrl } from "../../config/runtimeConfig";
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
  const subtitleKey = `header.brand_subtitles.${appName}`;
  const translatedSubtitle = t(subtitleKey);
  // t() returns the key itself when it is missing; render no subtitle rather than the raw key.
  const defaultSubtitle = translatedSubtitle === subtitleKey ? undefined : translatedSubtitle;

  return (
    <AppHeader
      appName={appName as any}
      brandTitle={brandTitle}
      brandSubtitle={brandSubtitle || defaultSubtitle}
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
