import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSharedMessages, Language } from '@alfheim/shared';

interface I18nContextType {
  locale: Language;
  setLocale: (lang: Language) => void;
  t: (path: string, fallback?: string) => string;
  messages: any;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Language>(() => {
    const saved = localStorage.getItem('alfheim_docs_lang') as Language;
    if (saved && ['de', 'en', 'pl'].includes(saved)) {
      return saved;
    }
    const navLang = navigator.language.slice(0, 2);
    if (navLang === 'de' || navLang === 'pl') return navLang as Language;
    return 'en';
  });

  const [messages, setMessages] = useState<any>(() => getSharedMessages(locale));

  useEffect(() => {
    setMessages(getSharedMessages(locale));
    localStorage.setItem('alfheim_docs_lang', locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (lang: Language) => {
    setLocaleState(lang);
  };

  const t = (path: string, fallback?: string): string => {
    const parts = path.split('.');
    let current = messages;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return fallback || path;
      }
    }
    return typeof current === 'string' ? current : fallback || path;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, messages }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useDocTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useDocTranslation must be used within an I18nProvider');
  }
  return ctx;
}
