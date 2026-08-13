/**
 * @alfheim/shared Assets Registry
 * Exposes asset paths and state keys for brand emblems and ALFI AI mascot states.
 */

export type AlfiState = 'idle' | 'thinking' | 'loading' | 'sleeping' | 'curious';

export const ALFI_MASCOT_ASSETS: Record<AlfiState, string> = {
  idle: 'alfi/alfi-idle.svg',
  thinking: 'alfi/alfi-thinking.svg',
  loading: 'alfi/alfi-loading.svg',
  sleeping: 'alfi/alfi-sleeping.svg',
  curious: 'alfi/alfi-curious.svg',
};

export const BRAND_ASSETS = {
  logoMark: 'brand/logo-mark.svg',
  logoFullDark: 'brand/logo-full-dark.svg',
  favicon: 'brand/favicon.svg',
} as const;

export function getAlfiAssetPath(state: AlfiState = 'idle'): string {
  return ALFI_MASCOT_ASSETS[state] || ALFI_MASCOT_ASSETS.idle;
}
