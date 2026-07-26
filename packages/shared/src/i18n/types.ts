import de from './dictionaries/de.json';

export type Language = 'de' | 'en' | 'pl';

export type Dictionary = typeof de;

export type TranslationParams = Record<string, string | number>;

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}
