'use client';

import { useContext } from 'react';
import { LanguageContext } from './LanguageContext';
import de from './dictionaries/de.json';
import en from './dictionaries/en.json';
import pl from './dictionaries/pl.json';
import { Dictionary, Language, TranslationParams } from './types';

const dictionaries: Record<Language, Dictionary> = {
  de,
  en,
  pl,
};

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  const language: Language = context?.language || 'de';

  const t = (key: string, params?: TranslationParams): string => {
    // 1. Attempt lookup in active language dictionary
    let value = getNestedValue(dictionaries[language], key);

    // 2. Fallback to master German dictionary if missing in active language
    if (!value && language !== 'de') {
      value = getNestedValue(dictionaries['de'], key);
    }

    // 3. Ultimate fallback: return key string
    if (!value) {
      value = key;
    }

    // Interpolate parameters if provided
    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        value = value!.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }

    return value;
  };

  return {
    t,
    language,
    setLanguage: context?.setLanguage || (() => {}),
  };
}
