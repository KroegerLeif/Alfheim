import { isHTTPError } from 'ky';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const MAX_MESSAGE_LENGTH = 300;
/** Machine-readable error codes such as `bad_request` are not shown to users. */
const MACHINE_CODE = /^[a-z0-9_]+$/;

/** HTTP status of a failed ky request, or undefined for network/other errors. */
export function getErrorStatus(error: unknown): number | undefined {
  if (isHTTPError(error)) return error.response.status;
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: unknown } }).response?.status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

function usableText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && text.length <= MAX_MESSAGE_LENGTH ? text : undefined;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Not JSON: the caller falls back to the plain text.
    return undefined;
  }
}

/**
 * Extracts the human-readable message from an error body. Understands the
 * household API (`{error, message}`), FastAPI apps (`{detail: string}` and
 * `{detail: {code, message}}`), JSON sent with a text content type, and
 * short plain-text bodies.
 */
export function messageFromBody(body: unknown): string | undefined {
  if (typeof body === 'string') {
    const parsed = parseJson(body);
    if (parsed !== undefined && typeof parsed !== 'string') return messageFromBody(parsed);
    return usableText(body);
  }
  if (!body || typeof body !== 'object') return undefined;
  const obj = body as Record<string, unknown>;
  const message = usableText(obj.message);
  if (message) return message;
  if (obj.detail && typeof obj.detail === 'object') return messageFromBody(obj.detail);
  const detail = usableText(obj.detail);
  if (detail) return detail;
  const code = usableText(obj.error);
  return code && !MACHINE_CODE.test(code) ? code : undefined;
}

/**
 * The backend's explanation for a failed request. ky (v2) parses the response
 * body into `HTTPError.data` before the error is thrown (issue #574).
 */
export function getServerMessage(error: unknown): string | undefined {
  if (!isHTTPError(error)) return undefined;
  return messageFromBody(error.data);
}

export type ApiErrorContext = 'household' | 'invite' | 'action';

/**
 * Maps an API error to a user-facing, translated message. 401, 403 and 404 get
 * dedicated explanations; everything else keeps the backend's own explanation
 * as detail instead of the raw `Request failed with status …`.
 */
export function describeApiError(error: unknown, t: Translate, context: ApiErrorContext = 'action'): string {
  const status = getErrorStatus(error);
  const serverMessage = getServerMessage(error);
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
      return t('household_app.errors.conflict', { detail: serverMessage ?? '' }).trim();
    default: {
      if (status === 400 && context === 'invite') return t('household_app.errors.invite_not_found');
      const detail = serverMessage ?? (error instanceof Error ? error.message : String(error ?? ''));
      return t('household_app.errors.generic', { detail });
    }
  }
}
