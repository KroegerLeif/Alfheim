import type { ApiError } from "./api";

/** Longest server message that is shown to the user; longer bodies are cut. */
const MAX_DETAIL_LENGTH = 300;

function isApiError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null && typeof (error as ApiError).message === "string";
}

/**
 * Build the message for a failed request: the localized `base` message followed by the (English)
 * detail the server returned, or by the localized `unreachable` hint when the request never
 * produced a response (network error, timeout).
 */
export function describeApiError(error: unknown, base: string, unreachable: string): string {
  if (!isApiError(error) || error.status === undefined) return `${base} ${unreachable}`;

  const detail = error.message.trim();
  if (!detail) return base;
  const shown = detail.length > MAX_DETAIL_LENGTH ? `${detail.slice(0, MAX_DETAIL_LENGTH)}…` : detail;
  return `${base} ${shown}`;
}
