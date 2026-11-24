'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, LanguageContextType } from './types';

const STORAGE_KEY = 'alfheim_language';
const DEFAULT_LANGUAGE: Language = 'de';
const SUPPORTED_LANGUAGES: readonly Language[] = ['de', 'en', 'pl'];

export const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
});

interface LanguageProviderProps {
  children: React.ReactNode;
  defaultLanguage?: Language;
}

export function LanguageProvider({
  children,
  defaultLanguage = DEFAULT_LANGUAGE,
}: LanguageProviderProps) {
  // The route locale (`defaultLanguage`) decides the language on every mount, so server and
  // client render the same text; switching it in the UI holds until the route locale changes.
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const [routeLanguage, setRouteLanguage] = useState<Language>(defaultLanguage);
  if (routeLanguage !== defaultLanguage) {
    setRouteLanguage(defaultLanguage);
    setLanguageState(defaultLanguage);
  }

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
      document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    }
  };

  // Carry a stored choice into the locale cookie, so the next server request picks it up.
  useEffect(() => {
    const savedLang = localStorage.getItem(STORAGE_KEY);
    if (savedLang && (SUPPORTED_LANGUAGES as readonly string[]).includes(savedLang)) {
      document.cookie = `NEXT_LOCALE=${savedLang}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
