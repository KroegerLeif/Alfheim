'use client';

import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_THEME_VARIANT } from '../tokens';
import { ResolvedMode, ThemeContextType, ThemeMode, ThemeOverrideConfig, ThemeVariant, CustomColorsConfig } from '../types';
import { getSystemMode, applyThemeToDOM } from '../utils/themeDomUtils';

const STORAGE_KEY = 'alfheim_theme_override';
const LEGACY_STORAGE_KEY = 'stitch-theme';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  defaultVariant?: ThemeVariant;
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
      } catch {}
    }
    return defaultMode;
  });

  const [variant, setVariantState] = useState<ThemeVariant>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedRaw = localStorage.getItem(STORAGE_KEY);
        if (savedRaw) {
          const parsed: ThemeOverrideConfig = JSON.parse(savedRaw);
          if (parsed.variant && ['nordic', 'obsidian', 'kinetic', 'slate', 'custom'].includes(parsed.variant)) {
            return parsed.variant;
          }
        }
        const legacyVariant = localStorage.getItem(LEGACY_STORAGE_KEY) as ThemeVariant;
        if (legacyVariant && ['nordic', 'obsidian', 'kinetic', 'slate', 'custom'].includes(legacyVariant)) {
          return legacyVariant;
        }
      } catch {}
    }
    return defaultVariant;
  });

  const [customColors, setCustomColorsState] = useState<CustomColorsConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('alfheim_custom_theme');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            dark: {
              primary: parsed.dark?.primary || '#10b981',
              canvas: parsed.dark?.canvas || '#0f172a',
              accent: parsed.dark?.accent || '#10b981',
              mint: parsed.dark?.mint || '#10b981',
              cyan: parsed.dark?.cyan || '#06b6d4',
              gold: parsed.dark?.gold || '#f59e0b',
            },
            light: {
              primary: parsed.light?.primary || '#059669',
              canvas: parsed.light?.canvas || '#f8fafc',
              accent: parsed.light?.accent || '#059669',
              mint: parsed.light?.mint || '#059669',
              cyan: parsed.light?.cyan || '#0891b2',
              gold: parsed.light?.gold || '#d97706',
            }
          };
        }
      } catch {}
    }
    return {
      dark: {
        primary: '#10b981', canvas: '#0f172a', accent: '#10b981',
        mint: '#10b981', cyan: '#06b6d4', gold: '#f59e0b',
      },
      light: {
        primary: '#059669', canvas: '#f8fafc', accent: '#059669',
        mint: '#059669', cyan: '#0891b2', gold: '#d97706',
      }
    };
  });

  const [systemMode, setSystemMode] = useState<ResolvedMode>(getSystemMode);

  const resolvedMode: ResolvedMode = mode === 'system' ? systemMode : mode;
  const isDark = resolvedMode === 'dark';

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setSystemMode(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          const parsed: ThemeOverrideConfig = JSON.parse(e.newValue || '{}');
          if (parsed.mode && ['dark', 'light', 'system'].includes(parsed.mode)) setModeState(parsed.mode);
          if (parsed.variant && ['nordic', 'obsidian', 'kinetic', 'slate', 'custom'].includes(parsed.variant)) setVariantState(parsed.variant);
        } catch {}
      } else if (e.key === 'alfheim_custom_theme') {
        try {
          const parsed = JSON.parse(e.newValue || '{}');
          if (parsed.dark || parsed.light) {
            setCustomColorsState({
              dark: {
                primary: parsed.dark?.primary || '#10b981', canvas: parsed.dark?.canvas || '#0f172a',
                accent: parsed.dark?.accent || '#10b981', mint: parsed.dark?.mint || '#10b981',
                cyan: parsed.dark?.cyan || '#06b6d4', gold: parsed.dark?.gold || '#f59e0b',
              },
              light: {
                primary: parsed.light?.primary || '#059669', canvas: parsed.light?.canvas || '#f8fafc',
                accent: parsed.light?.accent || '#059669', mint: parsed.light?.mint || '#059669',
                cyan: parsed.light?.cyan || '#0891b2', gold: parsed.light?.gold || '#d97706',
              }
            });
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
      localStorage.setItem('alfheim_custom_theme', JSON.stringify(newColors));
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setVariantState((prevVariant) => {
      const nextVariant: ThemeVariant = prevVariant === 'nordic' ? 'obsidian' : 'nordic';
      setModeState((prevMode) => {
        saveOverride(prevMode, nextVariant);
        return prevMode;
      });
      return nextVariant;
    });
  }, []);

  const contextValue = useMemo<ThemeContextType>(
    () => ({
      mode, variant, resolvedMode, isDark, setMode, setVariant, toggleTheme, customColors, setCustomColors,
    }),
    [mode, variant, resolvedMode, isDark, setMode, setVariant, toggleTheme, customColors, setCustomColors]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}
