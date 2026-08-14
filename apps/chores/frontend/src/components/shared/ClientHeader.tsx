"use client";

import { useAuth } from "@/core/authContext";
import { AppHeader } from "@alfheim/shared";

export function ClientHeader() {
  const { user, logout } = useAuth();

  return (
    <AppHeader
      appName="chores"
      brandTitle="ALFHEIM // CHORES"
      brandSubtitle="Gamified Habits"
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
