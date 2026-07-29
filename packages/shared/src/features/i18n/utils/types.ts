import { deMessages } from './locales';

export type Language = 'de' | 'en' | 'pl';

export type Dictionary = typeof deMessages;

export type TranslationParams = Record<string, string | number>;

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}
