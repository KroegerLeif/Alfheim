'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useHouseholds } from '@/features/household';
import { APP_ROUTES, ROUTES_ALLOWED_WITHOUT_HOUSEHOLD, toAppRoute } from '@/lib/routes';

function isAllowedWithoutHousehold(route: string): boolean {
  return ROUTES_ALLOWED_WITHOUT_HOUSEHOLD.some((r) => route === r || route.startsWith(`${r}/`));
}

/**
 * Sends users without any household to `/household/onboarding`.
 *
 * The browser location is checked as well as the router pathname: after the
 * OIDC callback the shared auth module restores deep links such as
 * `/household/join?token=…` via history.replaceState, which the router may
 * not have rendered yet. Such a join link must never be swallowed by the
 * onboarding redirect.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { data: households, isSuccess } = useHouseholds();

  useEffect(() => {
    if (!isSuccess || (households && households.length > 0)) return;
    const browserRoute = typeof window !== 'undefined' ? toAppRoute(window.location.pathname) : pathname;
    if (isAllowedWithoutHousehold(pathname) || isAllowedWithoutHousehold(browserRoute)) return;
    router.replace(APP_ROUTES.onboarding);
  }, [isSuccess, households, pathname, router]);

  return <>{children}</>;
}
