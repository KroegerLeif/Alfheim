"use client";

import { useAuth } from "@/core/authContext";
import { AppHeader } from "@alfheim/shared";
import { CheckSquare } from "lucide-react";

export function ClientHeader() {
  const { user, logout } = useAuth();

  return (
    <AppHeader
      brandTitle="Chores Tracker"
      brandSubtitle="Gamified Habits"
      brandIcon={<CheckSquare className="h-4 w-4" />}
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
