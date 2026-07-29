'use client';

import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { CSS_VAR_MAP, DEFAULT_THEME_MODE, DEFAULT_THEME_VARIANT, THEME_TOKENS } from '../tokens';
import { ResolvedMode, ThemeContextType, ThemeMode, ThemeOverrideConfig, ThemeTokens, ThemeVariant } from '../types';

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

function applyThemeToDOM(variant: ThemeVariant, resolvedMode: ResolvedMode) {
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
  const tokens: ThemeTokens = THEME_TOKENS[variant][resolvedMode];
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
          if (parsed.variant && ['obsidian', 'kinetic', 'slate'].includes(parsed.variant)) {
            return parsed.variant;
          }
        }
        const legacyVariant = localStorage.getItem(LEGACY_STORAGE_KEY) as ThemeVariant;
        if (legacyVariant && ['obsidian', 'kinetic', 'slate'].includes(legacyVariant)) {
          return legacyVariant;
        }
      } catch {
        // Ignore parse error
      }
    }
    return defaultVariant;
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

  // Update DOM when variant or resolvedMode changes
  useEffect(() => {
    applyThemeToDOM(variant, resolvedMode);
  }, [variant, resolvedMode]);

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
    }),
    [mode, variant, resolvedMode, isDark, setMode, setVariant, toggleTheme]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}
