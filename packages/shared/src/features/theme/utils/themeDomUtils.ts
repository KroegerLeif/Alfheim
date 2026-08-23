import { CSS_VAR_MAP, DEFAULT_THEME_MODE, THEME_TOKENS } from '../tokens';
import { ResolvedMode, ThemeTokens, ThemeVariant, CustomColorsConfig } from '../types';

export function getSystemMode(): ResolvedMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return DEFAULT_THEME_MODE;
}

export const parseHex = (hex: string) => {
  let sanitized = hex.replace('#', '');
  if (sanitized.length === 3) {
    sanitized = sanitized.split('').map(char => char + char).join('');
  }
  const r = parseInt(sanitized.substring(0, 2), 16) || 0;
  const g = parseInt(sanitized.substring(2, 4), 16) || 0;
  const b = parseInt(sanitized.substring(4, 6), 16) || 0;
  return { r, g, b };
};

export const hexToRgba = (hex: string, alpha: number) => {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const adjustBrightness = (hex: string, percent: number) => {
  const { r, g, b } = parseHex(hex);
  const adjust = (val: number) => Math.max(0, Math.min(255, val + percent));
  const toHex = (val: number) => {
    const h = val.toString(16);
    return h.length === 1 ? '0' + h : h;
  };
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
};

export function applyThemeToDOM(variant: ThemeVariant, resolvedMode: ResolvedMode, customColors?: CustomColorsConfig) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  root.setAttribute('data-theme', variant);
  root.setAttribute('data-mode', resolvedMode);
  root.setAttribute('data-theme-variant', variant);

  if (resolvedMode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }

  const variantTokens = THEME_TOKENS[variant] || THEME_TOKENS.nordic;
  let tokens: ThemeTokens = variantTokens[resolvedMode] || variantTokens.dark;

  if (variant === 'custom' && customColors) {
    const modeColors = customColors[resolvedMode];
    if (modeColors) {
      const primary = modeColors.primary || '#10b981';
      const canvas = modeColors.canvas || (resolvedMode === 'dark' ? '#0f172a' : '#f8fafc');
      const accent = modeColors.accent || primary;
      const mint = modeColors.mint || (resolvedMode === 'dark' ? '#10b981' : '#059669');
      const cyan = modeColors.cyan || (resolvedMode === 'dark' ? '#06b6d4' : '#0891b2');
      const gold = modeColors.gold || (resolvedMode === 'dark' ? '#f59e0b' : '#d97706');

      const isResolvedDark = resolvedMode === 'dark';
      const surfaceCard = isResolvedDark ? adjustBrightness(canvas, 10) : '#ffffff';
      const surfaceElevated = isResolvedDark ? adjustBrightness(canvas, 20) : adjustBrightness(canvas, -10);
      const borderSubtle = isResolvedDark ? adjustBrightness(canvas, 25) : adjustBrightness(canvas, -15);

      tokens = {
        ...tokens,
        primaryMain: primary,
        primaryHover: adjustBrightness(primary, isResolvedDark ? 20 : -20),
        accentMint: mint,
        accentCyan: cyan,
        accentGold: gold,
        surfaceCanvas: canvas,
        surfaceCard: surfaceCard,
        surfaceElevated: surfaceElevated,
        borderSubtle: borderSubtle,
        borderAccent: hexToRgba(accent, 0.4),
        accentGlow: hexToRgba(accent, 0.15)
      };
    }
  }

  (Object.keys(CSS_VAR_MAP) as Array<keyof ThemeTokens>).forEach((tokenKey) => {
    const varName = CSS_VAR_MAP[tokenKey];
    const varValue = tokens[tokenKey];
    if (varName && varValue) {
      root.style.setProperty(varName, varValue);
    }
  });
}
