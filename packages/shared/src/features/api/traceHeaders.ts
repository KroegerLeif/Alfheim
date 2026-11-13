import { generateW3CTraceparent } from './traceparent';

/**
 * Ensures a valid W3C traceparent header is present in the provided headers.
 * If a traceparent header (case-insensitive) is already set, it is left unchanged.
 */
export function withTraceparentHeaders(headers?: HeadersInit): Headers {
  const resolvedHeaders = new Headers(headers);
  if (!resolvedHeaders.has('traceparent')) {
    resolvedHeaders.set('traceparent', generateW3CTraceparent());
  }
  return resolvedHeaders;
}

/**
 * Creates a before-request hook function (e.g. for ky beforeRequest interceptor or custom fetch)
 * that injects a W3C traceparent header if not already set.
 */
export function createTraceparentHook() {
  return ({ request }: { request: Request }) => {
    if (!request.headers.has('traceparent')) {
      request.headers.set('traceparent', generateW3CTraceparent());
    }
  };
}

/**
 * Enhanced fetch wrapper that automatically injects a W3C traceparent header
 * into outgoing requests if not already set.
 */
export async function fetchWithTrace(
  input: RequestInfo | URL,
  init?: RequestInit,
  customFetch: typeof fetch = typeof window !== 'undefined' ? window.fetch : fetch
): Promise<Response> {
  const requestInit: RequestInit = {
    ...init,
    headers: withTraceparentHeaders(init?.headers),
  };
  return customFetch(input, requestInit);
}
