'use client';

import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { CSS_VAR_MAP, DEFAULT_THEME_MODE, DEFAULT_THEME_VARIANT, THEME_TOKENS } from '../tokens';
import { ResolvedMode, ThemeContextType, ThemeMode, ThemeOverrideConfig, ThemeTokens, ThemeVariant, CustomColorsConfig } from '../types';

const STORAGE_KEY = 'loeger_os_theme_override';
const LEGACY_STORAGE_KEY = 'stitch-theme';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  defaultVariant?: ThemeVariant;
}

function getSystemMode(): ResolvedMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return DEFAULT_THEME_MODE;
}

const parseHex = (hex: string) => {
  let sanitized = hex.replace('#', '');
  if (sanitized.length === 3) {
    sanitized = sanitized.split('').map(char => char + char).join('');
  }
  const r = parseInt(sanitized.substring(0, 2), 16) || 0;
  const g = parseInt(sanitized.substring(2, 4), 16) || 0;
  const b = parseInt(sanitized.substring(4, 6), 16) || 0;
  return { r, g, b };
};

const hexToRgba = (hex: string, alpha: number) => {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const adjustBrightness = (hex: string, percent: number) => {
  const { r, g, b } = parseHex(hex);
  const adjust = (val: number) => Math.max(0, Math.min(255, val + percent));
  const toHex = (val: number) => {
    const h = val.toString(16);
    return h.length === 1 ? '0' + h : h;
  };
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
};

function applyThemeToDOM(variant: ThemeVariant, resolvedMode: ResolvedMode, customColors?: CustomColorsConfig) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // 1. Data attributes
  root.setAttribute('data-theme', variant);
  root.setAttribute('data-mode', resolvedMode);
  root.setAttribute('data-theme-variant', variant);

  // 2. Class toggles for Tailwind CSS
  if (resolvedMode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }

  // 3. Inject CSS custom properties
  let tokens: ThemeTokens = THEME_TOKENS[variant][resolvedMode];

  if (variant === 'custom' && customColors) {
    const modeColors = customColors[resolvedMode];
    if (modeColors) {
      const primary = modeColors.primary;
      const canvas = modeColors.canvas;
      const accent = modeColors.accent || primary;

      const isResolvedDark = resolvedMode === 'dark';
      const surfaceCard = isResolvedDark ? adjustBrightness(canvas, 10) : '#ffffff';
      const surfaceElevated = isResolvedDark ? adjustBrightness(canvas, 20) : adjustBrightness(canvas, -10);
      const borderSubtle = isResolvedDark ? adjustBrightness(canvas, 25) : adjustBrightness(canvas, -15);

      tokens = {
        ...tokens,
        primaryMain: primary,
        primaryHover: adjustBrightness(primary, isResolvedDark ? 20 : -20),
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

export function ThemeProvider({
  children,
  defaultMode = 'dark',
  defaultVariant = DEFAULT_THEME_VARIANT,
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedRaw = localStorage.getItem(STORAGE_KEY);
        if (savedRaw) {
          const parsed: ThemeOverrideConfig = JSON.parse(savedRaw);
          if (parsed.mode && ['dark', 'light', 'system'].includes(parsed.mode)) {
            return parsed.mode;
          }
        }
      } catch {
        // Ignore parse error
      }
    }
    return defaultMode;
  });

  const [variant, setVariantState] = useState<ThemeVariant>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedRaw = localStorage.getItem(STORAGE_KEY);
        if (savedRaw) {
          const parsed: ThemeOverrideConfig = JSON.parse(savedRaw);
          if (parsed.variant && ['obsidian', 'kinetic', 'slate', 'custom'].includes(parsed.variant)) {
            return parsed.variant;
          }
        }
        const legacyVariant = localStorage.getItem(LEGACY_STORAGE_KEY) as ThemeVariant;
        if (legacyVariant && ['obsidian', 'kinetic', 'slate', 'custom'].includes(legacyVariant)) {
          return legacyVariant;
        }
      } catch {
        // Ignore parse error
      }
    }
    return defaultVariant;
  });

  const [customColors, setCustomColorsState] = useState<CustomColorsConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('loeger_os_custom_theme');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            dark: {
              primary: parsed.dark?.primary || '#3eb1ff',
              canvas: parsed.dark?.canvas || '#0b1326',
              accent: parsed.dark?.accent || '#3eb1ff',
            },
            light: {
              primary: parsed.light?.primary || '#0284c7',
              canvas: parsed.light?.canvas || '#f4f6fb',
              accent: parsed.light?.accent || '#0284c7',
            }
          };
        }
      } catch {
        // ignore
      }
    }
    return {
      dark: {
        primary: '#3eb1ff',
        canvas: '#0b1326',
        accent: '#3eb1ff',
      },
      light: {
        primary: '#0284c7',
        canvas: '#f4f6fb',
        accent: '#0284c7',
      }
    };
  });

  const [systemMode, setSystemMode] = useState<ResolvedMode>(getSystemMode);

  // Compute resolved mode ('dark' or 'light')
  const resolvedMode: ResolvedMode = mode === 'system' ? systemMode : mode;
  const isDark = resolvedMode === 'dark';

  // Listen for OS color scheme preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Listen for localStorage changes from other tabs/apps
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          const parsed: ThemeOverrideConfig = JSON.parse(e.newValue || '{}');
          if (parsed.mode && ['dark', 'light', 'system'].includes(parsed.mode)) {
            setModeState(parsed.mode);
          }
          if (parsed.variant && ['obsidian', 'kinetic', 'slate', 'custom'].includes(parsed.variant)) {
            setVariantState(parsed.variant);
          }
        } catch {}
      } else if (e.key === 'loeger_os_custom_theme') {
        try {
          const parsed = JSON.parse(e.newValue || '{}');
          if (parsed.dark || parsed.light) {
            setCustomColorsState({
              dark: {
                primary: parsed.dark?.primary || '#3eb1ff',
                canvas: parsed.dark?.canvas || '#0b1326',
                accent: parsed.dark?.accent || '#3eb1ff',
              },
              light: {
                primary: parsed.light?.primary || '#0284c7',
                canvas: parsed.light?.canvas || '#f4f6fb',
                accent: parsed.light?.accent || '#0284c7',
              }
            });
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update DOM when variant, resolvedMode, or customColors changes
  useEffect(() => {
    applyThemeToDOM(variant, resolvedMode, customColors);
  }, [variant, resolvedMode, customColors]);

  const saveOverride = (newMode: ThemeMode, newVariant: ThemeVariant) => {
    if (typeof window !== 'undefined') {
      const overrideConfig: ThemeOverrideConfig = { mode: newMode, variant: newVariant };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrideConfig));
      localStorage.setItem(LEGACY_STORAGE_KEY, newVariant);
    }
  };

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    setVariantState((prevVariant) => {
      saveOverride(newMode, prevVariant);
      return prevVariant;
    });
  }, []);

  const setVariant = useCallback((newVariant: ThemeVariant) => {
    setVariantState(newVariant);
    setModeState((prevMode) => {
      saveOverride(prevMode, newVariant);
      return prevMode;
    });
  }, []);

  const setCustomColors = useCallback((newColors: CustomColorsConfig) => {
    setCustomColorsState(newColors);
    if (typeof window !== 'undefined') {
      localStorage.setItem('loeger_os_custom_theme', JSON.stringify(newColors));
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setVariantState((prevVariant) => {
      const nextVariant: ThemeVariant = prevVariant === 'obsidian' ? 'kinetic' : 'obsidian';
      setModeState((prevMode) => {
        saveOverride(prevMode, nextVariant);
        return prevMode;
      });
      return nextVariant;
    });
  }, []);

  const contextValue = useMemo<ThemeContextType>(
    () => ({
      mode,
      variant,
      resolvedMode,
      isDark,
      setMode,
      setVariant,
      toggleTheme,
      customColors,
      setCustomColors,
    }),
    [mode, variant, resolvedMode, isDark, setMode, setVariant, toggleTheme, customColors, setCustomColors]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

