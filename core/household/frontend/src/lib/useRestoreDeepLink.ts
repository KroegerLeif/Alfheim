'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toAppRoute } from './routes';

/**
 * The OIDC redirect URI is the app root (`/household/`). After login the
 * shared auth module rewrites the address bar back to the originally
 * requested URL (e.g. `/household/join?token=…`) via history.replaceState
 * while the root page is still what is rendered. Used on the root page, this
 * hook navigates to the route the address bar actually shows.
 */
export function useRestoreDeepLink(): void {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const route = toAppRoute(window.location.pathname);
    if (route !== '/') {
      router.replace(`${route}${window.location.search}`);
    }
  }, [router]);
}
