'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Language, LanguageContextType } from './types';

const STORAGE_KEY = 'loeger_os_language';
const DEFAULT_LANGUAGE: Language = 'de';

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
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
      const cookieLang = match ? match[1] : null;
      if (cookieLang && ['de', 'en', 'pl'].includes(cookieLang)) {
        return cookieLang as Language;
      }
      const savedLang = localStorage.getItem(STORAGE_KEY) as Language;
      if (savedLang && ['de', 'en', 'pl'].includes(savedLang)) {
        return savedLang;
      }
    }
    return defaultLanguage;
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, lang);
      document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem(STORAGE_KEY) as Language;
      if (savedLang && ['de', 'en', 'pl'].includes(savedLang)) {
        if (savedLang !== language) {
          setLanguageState(savedLang);
        }
        document.cookie = `NEXT_LOCALE=${savedLang}; path=/; max-age=31536000; SameSite=Lax`;
      }
    }
  }, []);

  useEffect(() => {
    if (defaultLanguage && defaultLanguage !== language) {
      setLanguageState(defaultLanguage);
    }
  }, [defaultLanguage]);

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
