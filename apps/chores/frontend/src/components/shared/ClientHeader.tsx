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
      <div className="ml-4 pl-4 border-l border-[var(--border-subtle)] hidden sm:block">
        <HouseholdSwitcher />
      </div>
    </GlobalHeader>
  );
}
