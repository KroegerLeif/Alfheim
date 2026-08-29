/**
 * @alfheim/shared Assets Registry
 * Exposes asset paths, brand emblems, favicon bundle, and ALFI AI mascot states.
 */

export type AlfiCanonicalState =
  | 'idle'
  | 'thinking'
  | 'sleeping'
  | 'speaking'
  | 'listening'
  | 'eating'
  | 'fixing'
  | 'chasing';

export type AlfiState =
  | AlfiCanonicalState
  | 'loading'
  | 'curious'
  | (string & {});

export const ALFI_MASCOT_ASSETS: Record<string, string> = {
  idle: 'alfi/alfi-idle.svg',
  thinking: 'alfi/alfi-thinking.svg',
  sleeping: 'alfi/alfi-sleeping.svg',
  speaking: 'alfi/alfi-speaking.svg',
  listening: 'alfi/alfi-listening.svg',
  eating: 'alfi/alfi-eating.svg',
  fixing: 'alfi/alfi-fixing.svg',
  chasing: 'alfi/alfi-chasing.svg',
  // Backward-compatibility aliases
  loading: 'alfi/alfi-speaking.svg',
  curious: 'alfi/alfi-listening.svg',
};

export type AppSlug =
  | 'dashboard'
  | 'pantry'
  | 'chores'
  | 'maintenance'
  | 'shopping'
  | 'chat'
  | 'budget'
  | 'library'
  | 'workout'
  | (string & {});

export const APP_ICONS: Record<string, string> = {
  dashboard: 'apps/dashboard.svg',
  pantry: 'apps/pantry.svg',
  chores: 'apps/chores.svg',
  maintenance: 'apps/maintenance.svg',
  shopping: 'apps/shopping.svg',
  chat: 'apps/chat.svg',
  budget: 'apps/budget.svg',
  library: 'apps/library.svg',
  workout: 'apps/workout.svg',
};

export const BRAND_ASSETS = {
  logoMark: 'brand/logo-mark.svg',
  logoMarkWhite: 'brand/logo-mark-white.svg',
  faviconIco: 'favicon_io/favicon.ico',
  favicon16: 'favicon_io/favicon-16x16.png',
  favicon32: 'favicon_io/favicon-32x32.png',
  appleTouchIcon: 'favicon_io/apple-touch-icon.png',
  androidChrome192: 'favicon_io/android-chrome-192x192.png',
  androidChrome512: 'favicon_io/android-chrome-512x512.png',
  siteWebmanifest: 'favicon_io/site.webmanifest',
} as const;

/**
 * Returns the resolved relative path for a given ALFI mascot state,
 * falling back safely to the idle asset if the state is unmapped.
 */
export function getAlfiAssetPath(state: AlfiState = 'idle'): string {
  return ALFI_MASCOT_ASSETS[state] || ALFI_MASCOT_ASSETS.idle;
}

/**
 * Returns the resolved relative path for an app icon,
 * falling back safely to dashboard if the slug is unmapped.
 */
export function getAppIconPath(appSlug: AppSlug = 'dashboard'): string {
  return APP_ICONS[appSlug] || APP_ICONS.dashboard;
}
