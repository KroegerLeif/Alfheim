/**
 * Public URL contract of the household app.
 *
 * Other Alfheim apps may import these values (or copy the literal URLs) to
 * send users here, e.g. to onboarding when `GET /api/v1/households/me`
 * returns an empty list. All URLs are same-host, absolute paths including
 * the `/household` base path, so they work from any app behind Caddy.
 */
export const HOUSEHOLD_BASE_PATH = '/household';

/** Household list: create, join and switch households. */
export const HOUSEHOLD_LIST_URL = `${HOUSEHOLD_BASE_PATH}`;

/** Onboarding for users without any household (create or join). */
export const HOUSEHOLD_ONBOARDING_URL = `${HOUSEHOLD_BASE_PATH}/onboarding`;

/** Redeems an invite token after login: `?token=<token>`. */
export const HOUSEHOLD_JOIN_URL = `${HOUSEHOLD_BASE_PATH}/join`;

/** Profile page (moved from the dashboard's `/profile`). */
export const HOUSEHOLD_PROFILE_URL = `${HOUSEHOLD_BASE_PATH}/profile`;

/** Detail page for a single household. */
export function householdDetailUrl(householdId: string): string {
  return `${HOUSEHOLD_BASE_PATH}/${encodeURIComponent(householdId)}`;
}

/**
 * Builds the absolute join URL encoded in invite QR codes:
 * `https://<host>/household/join?token=<token>`.
 *
 * @param origin Scheme + host, defaults to the current window origin.
 */
export function buildJoinUrl(token: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}${HOUSEHOLD_JOIN_URL}?token=${encodeURIComponent(token)}`;
}

/**
 * Sends the browser to household onboarding. Intended for other apps that
 * detect a user without households; inside this app use the router instead.
 */
export function redirectToHouseholdOnboarding(): void {
  if (typeof window !== 'undefined') {
    // Cross-app navigation (called from other apps), so not a Next.js router push.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(HOUSEHOLD_ONBOARDING_URL);
  }
}

/**
 * In-app (basePath-relative) routes, for next/link and next/navigation which
 * prepend the basePath themselves.
 */
export const APP_ROUTES = {
  list: '/',
  onboarding: '/onboarding',
  join: '/join',
  profile: '/profile',
  detail: (householdId: string) => `/${encodeURIComponent(householdId)}`,
} as const;

/** Converts a full browser pathname (`/household/join`) into an app route (`/join`). */
export function toAppRoute(browserPathname: string): string {
  if (browserPathname === HOUSEHOLD_BASE_PATH) return '/';
  if (browserPathname.startsWith(`${HOUSEHOLD_BASE_PATH}/`)) {
    return browserPathname.slice(HOUSEHOLD_BASE_PATH.length) || '/';
  }
  return browserPathname || '/';
}

/** App routes a user without any household may still visit. */
export const ROUTES_ALLOWED_WITHOUT_HOUSEHOLD: readonly string[] = [
  APP_ROUTES.onboarding,
  APP_ROUTES.join,
  APP_ROUTES.profile,
];
