export type ThemeVariant = 'obsidian' | 'kinetic' | 'slate';
export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedMode = 'dark' | 'light';

export interface ThemeTokens {
  surfaceCanvas: string;
  surfaceCard: string;
  surfaceElevated: string;
  primaryMain: string;
  primaryHover: string;
  borderSubtle: string;
  borderAccent: string;
  textMain: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  accentGlow: string;
}

export interface ThemeOverrideConfig {
  mode?: ThemeMode;
  variant?: ThemeVariant;
}

export interface ThemeContextType {
  mode: ThemeMode;
  variant: ThemeVariant;
  resolvedMode: ResolvedMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  setVariant: (variant: ThemeVariant) => void;
  toggleTheme: () => void;
}
