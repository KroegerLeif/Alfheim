'use client';

import { AppHeader, useTranslation } from '@alfheim/shared';
import { useAuth } from '@/core/providers';

/**
 * Dashboard Header utilizing the unified @alfheim/shared AppHeader layout.
 * The search field and notification bell were removed: neither had a backend
 * behind it (the bell always showed an empty list), so they are not rendered.
 */
export function Header() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const authUser = user ? {
    name: user.name,
    preferred_username: user.preferred_username,
    email: user.email,
  } : null;

  return (
    <AppHeader
      appName="dashboard"
      brandTitle="ALFHEIM // DASHBOARD"
      brandSubtitle={t('header.brand_subtitles.dashboard')}
      showBackToDashboard={false}
      user={authUser}
      onLogout={logout}
    />
  );
}
