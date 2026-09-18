'use client';

import { usePathname } from 'next/navigation';
import { ClientHeader as SharedClientHeader, Sidebar as SharedSidebar } from '@alfheim/shared';
import { useTranslation } from '@/i18n';
import { APP_ROUTES } from '@/lib/routes';

export function AppHeader() {
  const { t } = useTranslation();
  return (
    <SharedClientHeader
      appName="household"
      brandTitle="ALFHEIM // HOUSEHOLD"
      brandSubtitle={t('household_app.brand_subtitle')}
    />
  );
}

export function AppSidebar() {
  const { t } = useTranslation();
  const pathname = usePathname() || '/';
  const isProfile = pathname.startsWith(APP_ROUTES.profile);

  const navItems = [
    {
      href: APP_ROUTES.list,
      label: t('household_app.nav.households'),
      icon: <span className="material-symbols-outlined text-base shrink-0" aria-hidden="true">home</span>,
    },
    {
      href: APP_ROUTES.profile,
      label: t('household_app.nav.profile'),
      icon: <span className="material-symbols-outlined text-base shrink-0" aria-hidden="true">person</span>,
    },
  ];

  return (
    <SharedSidebar
      appName="household"
      navItems={navItems}
      activeHref={isProfile ? APP_ROUTES.profile : APP_ROUTES.list}
      isCollapsible
    />
  );
}
