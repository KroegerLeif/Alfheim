import { parseApiErrorBody } from '../household/householdStore';
import type { ApiErrorMapper } from './types';

/**
 * Text for a failed request that is shown to the user as-is.
 *
 * ky (v2) wraps a failed `fetch` in a `NetworkError` whose own message embeds the request method
 * and URL. The browser's original message (for example `Failed to fetch`) is in `cause`, so that is
 * what users keep seeing, as before ky v2.
 */
export function getRequestErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'NetworkError' && error.cause instanceof Error) {
    return error.cause.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/** A non-2xx response from an Alfheim API, thrown by the shared API client. */
export class ApiError extends Error {
  /** HTTP status code. */
  readonly status: number;
  /** Machine-readable error code from the body (`detail.code` or `error`), if any. */
  readonly code: string | null;
  /** Parsed response body: JSON when the body parses, else the text, else undefined. */
  readonly data: unknown;
  /** The failed response (body already consumed). */
  readonly response: Response;

  constructor(response: Response, data: unknown, message?: string, code: string | null = null) {
    super(message || `Request failed with status ${response.status}`);
    this.name = 'ApiError';
    this.status = response.status;
    this.code = code;
    this.data = data;
    this.response = response;
  }
}

/** A request the shared API client aborted after its timeout. */
export class ApiTimeoutError extends Error {
  /** The timeout that elapsed, in milliseconds. */
  readonly timeoutMs: number;

  constructor(url: string, timeoutMs: number, options?: { cause?: unknown }) {
    super(`Request timed out after ${timeoutMs} ms: ${url}`, options);
    this.name = 'ApiTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** Type guard for {@link ApiError}. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Type guard for {@link ApiTimeoutError}. */
export function isApiTimeoutError(error: unknown): error is ApiTimeoutError {
  return error instanceof ApiTimeoutError;
}

/**
 * Reads a response body for error reporting: parsed JSON when it parses, otherwise the raw
 * text, or undefined for an empty body.
 */
export async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Not JSON: plain-text bodies are returned as they are.
    return text;
  }
}

/**
 * Default {@link ApiErrorMapper}: an {@link ApiError} with the message and code of the
 * structured error contract (`{detail: {code, message}}`, `{detail}`, `{error, message}`).
 */
export const defaultApiErrorMapper: ApiErrorMapper = (response, body) => {
  const parsed = parseApiErrorBody(body);
  const rawError =
    body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  const errorField = typeof rawError === 'string' ? rawError : null;
  const message = parsed.message || errorField || undefined;
  return new ApiError(response, body, message, parsed.code ?? errorField);
};
