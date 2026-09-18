import { isHTTPError } from 'ky';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** HTTP status of a failed ky request, or undefined for network/other errors. */
export function getErrorStatus(error: unknown): number | undefined {
  if (isHTTPError(error)) return error.response.status;
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: unknown } }).response?.status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

/** Best-effort server-provided message (`{error}` / `{message}` / plain text). */
function getServerMessage(error: unknown): string | undefined {
  if (!isHTTPError(error)) return undefined;
  const data: unknown = error.data;
  if (typeof data === 'string' && data.trim() && data.length < 300) return data.trim();
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail']) {
      if (typeof obj[key] === 'string' && obj[key]) return obj[key] as string;
    }
  }
  return undefined;
}

export type ApiErrorContext = 'household' | 'invite' | 'action';

/**
 * Maps an API error to a user-facing, translated message. 403 and 404 get
 * dedicated explanations instead of the raw `Request failed with status …`.
 */
export function describeApiError(error: unknown, t: Translate, context: ApiErrorContext = 'action'): string {
  const status = getErrorStatus(error);
  switch (status) {
    case 401:
      return t('household_app.errors.unauthorized');
    case 403:
      return t('household_app.errors.forbidden');
    case 404:
      return context === 'invite'
        ? t('household_app.errors.invite_not_found')
        : t('household_app.errors.household_not_found');
    case 409:
      return t('household_app.errors.conflict', { detail: getServerMessage(error) ?? '' }).trim();
    default: {
      const detail =
        getServerMessage(error) ??
        (error instanceof Error ? error.message : String(error ?? ''));
      return t('household_app.errors.generic', { detail });
    }
  }
}
