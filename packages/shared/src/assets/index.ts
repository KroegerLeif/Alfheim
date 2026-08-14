/**
 * @alfheim/shared Assets Registry
 * Exposes asset paths, brand emblems, favicon bundle, and ALFI AI mascot states.
 */

export type AlfiState =
  | 'idle'
  | 'thinking'
  | 'sleeping'
  | 'speaking'
  | 'listening'
  | 'eating'
  | 'fixing'
  | 'chasing'
  | 'loading'
  | 'curious';

export const ALFI_MASCOT_ASSETS: Record<AlfiState, string> = {
  idle: 'alfi/alfi-idle.svg',
  thinking: 'alfi/alfi-thinking.svg',
  sleeping: 'alfi/alfi-sleeping.svg',
  speaking: 'alfi/alfi-speaking.svg',
  listening: 'alfi/alfi-listenig.svg',
  eating: 'alfi/alfi-eating.svg',
  fixing: 'alfi/alfi-fixing.svg',
  chasing: 'alfi/alfi-chasing.svg',
  // Compatibility aliases
  loading: 'alfi/alfi-speaking.svg',
  curious: 'alfi/alfi-listenig.svg',
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

export function getAlfiAssetPath(state: AlfiState = 'idle'): string {
  return ALFI_MASCOT_ASSETS[state] || ALFI_MASCOT_ASSETS.idle;
}
