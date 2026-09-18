'use client';

import { useTranslation as useSharedTranslation } from '@alfheim/shared';
import en from './messages/en.json';
import de from './messages/de.json';

type Params = Record<string, string | number>;
type Messages = Record<string, unknown>;

/**
 * App-local strings (EN + DE) for everything new in the household app.
 * Keys live under `household_app.*`. Everything else (moved dashboard
 * strings under `household.*`, `profile.*`, `common.*`) still resolves
 * through the shared `@alfheim/shared` dictionaries, exactly like the
 * dashboard does. Missing languages fall back to German, like the shared hook.
 */
export const localMessages: Record<string, Messages> = { en, de };

function lookup(messages: Messages | undefined, key: string): string | undefined {
  let current: unknown = messages;
  for (const part of key.split('.')) {
    if (current && typeof current === 'object' && part in (current as Messages)) {
      current = (current as Messages)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(value: string, params?: Params): string {
  if (!params) return value;
  return Object.entries(params).reduce(
    (acc, [name, val]) => acc.replace(new RegExp(`\\{${name}\\}`, 'g'), String(val)),
    value,
  );
}

export function translateLocal(language: string, key: string, params?: Params): string | undefined {
  const value = lookup(localMessages[language], key) ?? lookup(localMessages.de, key);
  return value === undefined ? undefined : interpolate(value, params);
}

export function useTranslation() {
  const shared = useSharedTranslation();
  const t = (key: string, params?: Params): string =>
    translateLocal(shared.language, key, params) ?? shared.t(key, params);
  return { ...shared, t };
}
