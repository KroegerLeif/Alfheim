import type { TranslationParams } from "@alfheim/shared";
import { ApiError } from "./api";

type TranslateFn = (key: string, params?: TranslationParams) => string;

/** Backend error codes that have a dedicated, localized explanation. */
const CODE_MESSAGE_KEYS: Record<string, string> = {
  session_not_active: "workout.errorSessionNotActive",
};

/**
 * Turn a failed request into text for the user.
 *
 * Known backend codes map to a localized sentence. Other API errors keep the
 * localized `fallbackKey` and append the server's detail (validation messages
 * are only available in English). Network failures and timeouts, which carry
 * no API detail, show the localized fallback alone.
 */
export function describeError(error: unknown, t: TranslateFn, fallbackKey: string): string {
  if (error instanceof ApiError) {
    const codeKey = error.code ? CODE_MESSAGE_KEYS[error.code] : undefined;
    if (codeKey) return t(codeKey);
    if (error.message) return `${t(fallbackKey)}: ${error.message}`;
  }
  return t(fallbackKey);
}
