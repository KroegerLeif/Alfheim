import { ResolvedMode, ThemeTokens, ThemeVariant } from '../types';
import obsidianTheme from './themes/obsidian.json';
import kineticTheme from './themes/kinetic.json';
import slateTheme from './themes/slate.json';

export const DEFAULT_THEME_VARIANT: ThemeVariant = 'obsidian';
export const DEFAULT_THEME_MODE: ResolvedMode = 'dark';

export const THEME_TOKENS: Record<ThemeVariant, Record<ResolvedMode, ThemeTokens>> = {
  obsidian: obsidianTheme as Record<ResolvedMode, ThemeTokens>,
  kinetic: kineticTheme as Record<ResolvedMode, ThemeTokens>,
  slate: slateTheme as Record<ResolvedMode, ThemeTokens>,
};

export const CSS_VAR_MAP: Record<keyof ThemeTokens, string> = {
  surfaceCanvas: '--surface-canvas',
  surfaceCard: '--surface-card',
  surfaceElevated: '--surface-elevated',
  primaryMain: '--primary-main',
  primaryHover: '--primary-hover',
  borderSubtle: '--border-subtle',
  borderAccent: '--border-accent',
  textMain: '--text-main',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  textFaint: '--text-faint',
  accentGlow: '--accent-glow',
};
