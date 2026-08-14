export type ThemeVariant = 'nordic' | 'obsidian' | 'kinetic' | 'slate' | 'custom';
export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedMode = 'dark' | 'light';

export interface CustomModeColors {
  primary: string;
  canvas: string;
  accent: string;
  mint?: string;
  cyan?: string;
  gold?: string;
}

export interface CustomColorsConfig {
  dark: CustomModeColors;
  light: CustomModeColors;
}

export interface ThemeTokens {
  surfaceCanvas: string;
  surfaceCard: string;
  surfaceElevated: string;
  primaryMain: string;
  primaryHover: string;
  accentMint: string;
  accentCyan: string;
  accentGold: string;
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
  customColors: CustomColorsConfig;
  setCustomColors: (colors: CustomColorsConfig) => void;
}
