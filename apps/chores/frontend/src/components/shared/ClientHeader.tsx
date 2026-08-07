"use client";

import { useAuth } from "@/core/authContext";
import { GlobalHeader, HouseholdSwitcher } from "@loeger-os/shared";

export function ClientHeader() {
  const { user, logout } = useAuth();

  return (
    <GlobalHeader
      brandTitle="Chores Tracker"
      brandSubtitle="Gamified Habits"
      showBackToDashboard={true}
      backToDashboardHref="http://loeger-os/"
      showLanguageSwitcher={true}
      showThemeToggle={true}
      showAuthControls={true}
      user={user}
      onLogout={logout}
    >
      <div className="ml-2 pl-3 border-l border-[var(--border-subtle)] flex items-center">
        <HouseholdSwitcher />
      </div>
    </GlobalHeader>
  );
}
