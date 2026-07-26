import { ResolvedMode, ThemeTokens, ThemeVariant } from './types';

export const DEFAULT_THEME_VARIANT: ThemeVariant = 'obsidian';
export const DEFAULT_THEME_MODE: ResolvedMode = 'dark';

export const THEME_TOKENS: Record<ThemeVariant, Record<ResolvedMode, ThemeTokens>> = {
  obsidian: {
    dark: {
      surfaceCanvas: '#0b1326',
      surfaceCard: '#111b33',
      surfaceElevated: '#182542',
      primaryMain: '#3eb1ff',
      primaryHover: '#60beff',
      borderSubtle: '#222222',
      borderAccent: 'rgba(62, 177, 255, 0.3)',
      textMain: '#f0f6fc',
      textMuted: '#8b949e',
      accentGlow: 'rgba(62, 177, 255, 0.15)',
    },
    light: {
      surfaceCanvas: '#f4f6fb',
      surfaceCard: '#ffffff',
      surfaceElevated: '#e8eeef',
      primaryMain: '#0284c7',
      primaryHover: '#0369a1',
      borderSubtle: '#e2e8f0',
      borderAccent: 'rgba(2, 132, 199, 0.3)',
      textMain: '#0f172a',
      textMuted: '#64748b',
      accentGlow: 'rgba(2, 132, 199, 0.15)',
    },
  },
  kinetic: {
    dark: {
      surfaceCanvas: '#060b17',
      surfaceCard: '#0c162d',
      surfaceElevated: '#142244',
      primaryMain: '#00f0ff',
      primaryHover: '#38f4ff',
      borderSubtle: '#1e293b',
      borderAccent: 'rgba(0, 240, 255, 0.5)',
      textMain: '#ffffff',
      textMuted: '#94a3b8',
      accentGlow: 'rgba(0, 240, 255, 0.25)',
    },
    light: {
      surfaceCanvas: '#fafafa',
      surfaceCard: '#ffffff',
      surfaceElevated: '#f1f5f9',
      primaryMain: '#008899',
      primaryHover: '#006677',
      borderSubtle: '#cbd5e1',
      borderAccent: 'rgba(0, 136, 153, 0.4)',
      textMain: '#090d16',
      textMuted: '#475569',
      accentGlow: 'rgba(0, 136, 153, 0.2)',
    },
  },
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
  textMuted: '--text-muted',
  accentGlow: '--accent-glow',
};
