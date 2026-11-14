import { CustomColorsConfig, CustomModeColors } from '../types';

/** Custom theme colors used when nothing (or nothing valid) is stored. */
export const DEFAULT_CUSTOM_COLORS: CustomColorsConfig = {
  dark: { primary: '#10b981', canvas: '#0f172a', accent: '#10b981', mint: '#10b981', cyan: '#06b6d4', gold: '#f59e0b' },
  light: { primary: '#059669', canvas: '#f8fafc', accent: '#059669', mint: '#059669', cyan: '#0891b2', gold: '#d97706' },
};

function mergeMode(saved: Partial<CustomModeColors> | undefined, fallback: CustomModeColors): CustomModeColors {
  return {
    primary: saved?.primary || fallback.primary,
    canvas: saved?.canvas || fallback.canvas,
    accent: saved?.accent || fallback.accent,
    mint: saved?.mint || fallback.mint,
    cyan: saved?.cyan || fallback.cyan,
    gold: saved?.gold || fallback.gold,
  };
}

/**
 * Fills a stored custom color config with the defaults for every missing value.
 *
 * Stored values come from localStorage and may be partial or written by an older version.
 */
export function withDefaultCustomColors(saved: Partial<Record<'dark' | 'light', Partial<CustomModeColors>>>): CustomColorsConfig {
  return {
    dark: mergeMode(saved.dark, DEFAULT_CUSTOM_COLORS.dark),
    light: mergeMode(saved.light, DEFAULT_CUSTOM_COLORS.light),
  };
}
