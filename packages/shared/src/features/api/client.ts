import { ApiTimeoutError, defaultApiErrorMapper, readResponseBody } from './errors';
import { createBrowserApiSession } from './session';
import { isRawBody, resolveApiBaseUrl, withResponseHelpers, withSearchParams } from './requestHelpers';
import { withTraceparentHeaders } from './traceHeaders';
import type {
  ApiClientOptions,
  ApiErrorMapper,
  ApiRequestInit,
  ApiResponsePromise,
  ApiSession,
} from './types';

export { withTraceparentHeaders, createTraceparentHook, fetchWithTrace } from './traceHeaders';
export { resolveApiBaseUrl } from './requestHelpers';
export type {
  ApiClientOptions,
  ApiErrorMapper,
  ApiRequestInit,
  ApiResponsePromise,
  ApiSearchParams,
  ApiSession,
} from './types';

/** Default request timeout of the shared API client, in milliseconds. */
export const DEFAULT_API_TIMEOUT_MS = 8000;

/**
 * Centralized API client of `@alfheim/shared`: W3C traceparent on every request, a default
 * timeout, and optionally the signed-in session (bearer token, 401 refresh, household headers)
 * and mapped errors. Create instances with {@link createApiClient}.
 */
export class ApiClient {
  private readonly baseUrl: string | null;
  private readonly basePath: string | null;
  private readonly apiUrl: string | undefined;
  private readonly defaultHeaders: HeadersInit;
  private readonly customFetch: typeof fetch | undefined;
  private readonly defaultOptions: RequestInit;
  private readonly timeoutMs: number | false;
  private readonly session: ApiSession | null;
  private readonly throwHttpErrors: boolean;
  private readonly mapError: ApiErrorMapper;

  constructor(options: ApiClientOptions = {}) {
    const {
      baseUrl, basePath, apiUrl, headers = {}, fetch: fetchImpl, timeoutMs = DEFAULT_API_TIMEOUT_MS,
      session, throwHttpErrors, mapError = defaultApiErrorMapper, ...restOptions
    } = options;
    this.baseUrl = baseUrl !== undefined ? baseUrl.replace(/\/+$/, '') : null;
    this.basePath = basePath ?? null;
    this.apiUrl = apiUrl;
    this.defaultHeaders = headers;
    this.customFetch = fetchImpl;
    this.defaultOptions = restOptions;
    this.timeoutMs = timeoutMs;
    this.session = session === true ? createBrowserApiSession() : session || null;
    this.throwHttpErrors = throwHttpErrors ?? this.session !== null;
    this.mapError = mapError;
  }

  private resolveUrl(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    const base = this.baseUrl ?? (this.basePath !== null ? resolveApiBaseUrl(this.basePath, this.apiUrl) : '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${base}${path}`;
  }

  private buildHeaders(init: HeadersInit | undefined, token: string | null): Headers {
    const headers = new Headers(this.defaultHeaders);
    new Headers(init).forEach((value, key) => headers.set(key, value));
    this.session?.prepareHeaders?.(headers);
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    return withTraceparentHeaders(headers);
  }

  private async dispatch(url: string, init: RequestInit, timeoutMs: number | false): Promise<Response> {
    const fetchImpl = this.customFetch ?? globalThis.fetch;
    const signals = [init.signal, timeoutMs === false ? null : AbortSignal.timeout(timeoutMs)].filter(
      (signal): signal is AbortSignal => Boolean(signal),
    );
    const signal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];
    try {
      return await fetchImpl(url, signal ? { ...init, signal } : init);
    } catch (error) {
      if (timeoutMs !== false && error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiTimeoutError(url, timeoutMs, { cause: error });
      }
      throw error;
    }
  }

  private async refreshToken(session: ApiSession): Promise<string | null> {
    try {
      return (await session.refreshToken?.()) ?? null;
    } catch (error) {
      console.warn('Access token refresh failed after a 401:', error);
      return null;
    }
  }

  private async send(endpoint: string, init: ApiRequestInit): Promise<Response> {
    const { timeoutMs, stream, throwHttpErrors, headers, searchParams, ...requestInit } = init;
    const url = withSearchParams(this.resolveUrl(endpoint), searchParams);
    const timeout = stream ? false : (timeoutMs ?? this.timeoutMs);
    const attempt = (token: string | null) =>
      this.dispatch(url, { ...this.defaultOptions, ...requestInit, headers: this.buildHeaders(headers, token) }, timeout);

    const session = this.session;
    let response = await attempt(session?.getToken() ?? null);
    if (response.status === 401 && session?.refreshToken) {
      const token = await this.refreshToken(session);
      if (token) response = await attempt(token);
      else session.onAuthFailure?.();
    }
    if (!response.ok) {
      await session?.onErrorResponse?.(response);
      if (throwHttpErrors ?? this.throwHttpErrors) {
        throw this.mapError(response, await readResponseBody(response));
      }
    }
    return response;
  }

  /** Sends a request. Resolves with the response; rejects on non-2xx when `throwHttpErrors` is set. */
  request(endpoint: string, init: ApiRequestInit = {}): ApiResponsePromise {
    return withResponseHelpers(this.send(endpoint, init));
  }

  private withBody(method: string, endpoint: string, body: unknown, init?: ApiRequestInit): ApiResponsePromise {
    const headers = new Headers(init?.headers);
    const raw = body === undefined || isRawBody(body);
    if (!raw && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return this.request(endpoint, {
      ...init,
      method,
      headers,
      body: raw ? (body as BodyInit | undefined) : JSON.stringify(body),
    });
  }

  /** GET request. */
  get(endpoint: string, init?: ApiRequestInit): ApiResponsePromise {
    return this.request(endpoint, { ...init, method: 'GET' });
  }

  /** POST request; plain objects are sent as JSON, `FormData` and other bodies as they are. */
  post(endpoint: string, body?: unknown, init?: ApiRequestInit): ApiResponsePromise {
    return this.withBody('POST', endpoint, body, init);
  }

  /** PUT request; plain objects are sent as JSON. */
  put(endpoint: string, body?: unknown, init?: ApiRequestInit): ApiResponsePromise {
    return this.withBody('PUT', endpoint, body, init);
  }

  /** PATCH request; plain objects are sent as JSON. */
  patch(endpoint: string, body?: unknown, init?: ApiRequestInit): ApiResponsePromise {
    return this.withBody('PATCH', endpoint, body, init);
  }

  /** DELETE request. */
  delete(endpoint: string, init?: ApiRequestInit): ApiResponsePromise {
    return this.request(endpoint, { ...init, method: 'DELETE' });
  }
}

/**
 * Creates an API client. Without options it behaves as before (traceparent only, responses
 * returned as they are) plus the default timeout. A typical app client:
 *
 * @example
 * export const api = createApiClient({ basePath: '/api/v1/chat', apiUrl: process.env.NEXT_PUBLIC_API_URL, session: true });
 */
export function createApiClient(options?: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
