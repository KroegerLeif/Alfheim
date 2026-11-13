import { resolveApiUrl, resolveFrontendUrl } from '../config/runtimeConfig';
import type { ApiResponsePromise } from './types';

/**
 * Resolves an API path such as `/api/v1/chat` to an absolute base URL without a trailing slash:
 * runtime config first, then `apiUrl`, then the current origin (or the frontend URL on the server).
 */
export function resolveApiBaseUrl(basePath: string, apiUrl?: string): string {
  let resolved = resolveApiUrl(basePath, apiUrl);
  if (resolved.startsWith('/')) {
    const origin = typeof window !== 'undefined' ? window.location.origin : resolveFrontendUrl();
    resolved = origin + resolved;
  }
  return resolved.replace(/\/+$/, '');
}

/** True for bodies `fetch` sends as they are; anything else is serialized as JSON. */
export function isRawBody(body: unknown): body is BodyInit {
  return (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    body instanceof ReadableStream
  );
}

/** Adds the `json()` and `text()` shortcuts to a pending response. */
export function withResponseHelpers(pending: Promise<Response>): ApiResponsePromise {
  const promise = pending as ApiResponsePromise;
  promise.json = async <T>() => {
    const response = await pending;
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  };
  promise.text = async () => (await pending).text();
  return promise;
}
