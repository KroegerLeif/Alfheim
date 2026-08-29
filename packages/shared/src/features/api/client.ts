import { generateW3CTraceparent } from './traceparent';

export interface ApiClientOptions extends Omit<RequestInit, 'headers'> {
  baseUrl?: string;
  headers?: HeadersInit;
  fetch?: typeof fetch;
}

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
  return (request: Request) => {
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

/**
 * Centralized API client class for @alfheim/shared providing
 * automatic W3C traceparent header injection on HTTP requests.
 */
export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;
  private customFetch: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    const { baseUrl = '', headers = {}, fetch: fetchImpl, ...restOptions } = options;
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.defaultHeaders = headers;
    this.customFetch =
      fetchImpl || (typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch);
    this.defaultOptions = restOptions;
  }

  private defaultOptions: RequestInit;

  private resolveUrl(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${path}`;
  }

  /**
   * Dispatches an HTTP request with automatic traceparent header injection.
   */
  async request(endpoint: string, init: RequestInit = {}): Promise<Response> {
    const url = this.resolveUrl(endpoint);

    // Merge default headers with call-specific headers
    const mergedHeaders = new Headers(this.defaultHeaders);
    if (init.headers) {
      new Headers(init.headers).forEach((value, key) => {
        mergedHeaders.set(key, value);
      });
    }

    const finalHeaders = withTraceparentHeaders(mergedHeaders);

    const mergedOptions: RequestInit = {
      ...this.defaultOptions,
      ...init,
      headers: finalHeaders,
    };

    return this.customFetch(url, mergedOptions);
  }

  async get(endpoint: string, init?: RequestInit): Promise<Response> {
    return this.request(endpoint, { ...init, method: 'GET' });
  }

  async post(endpoint: string, body?: unknown, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return this.request(endpoint, {
      ...init,
      method: 'POST',
      headers,
      body: typeof body === 'string' || body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  async put(endpoint: string, body?: unknown, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return this.request(endpoint, {
      ...init,
      method: 'PUT',
      headers,
      body: typeof body === 'string' || body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  async patch(endpoint: string, body?: unknown, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers);
    if (body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return this.request(endpoint, {
      ...init,
      method: 'PATCH',
      headers,
      body: typeof body === 'string' || body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  async delete(endpoint: string, init?: RequestInit): Promise<Response> {
    return this.request(endpoint, { ...init, method: 'DELETE' });
  }
}

/**
 * Creates a new centralized API client instance.
 */
export function createApiClient(options?: ApiClientOptions): ApiClient {
  return new ApiClient(options);
}
