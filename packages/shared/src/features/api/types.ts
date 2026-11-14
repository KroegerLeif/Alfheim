/**
 * Public option and result types of the shared API client. Kept apart from the
 * implementation so apps and other shared modules can type against them alone.
 */

/** Builds the error that a failed response is turned into. `body` is the parsed response body. */
export type ApiErrorMapper = (response: Response, body: unknown) => Error;

/**
 * The signed-in user's session as the API client sees it. Inject a custom one in tests or
 * non-browser callers; `createBrowserApiSession()` is the default for `session: true`.
 */
export interface ApiSession {
  /** Current access token, or null when there is none. */
  getToken(): string | null;
  /** Fetches a fresh token after a 401. Resolves to null when no refresh is possible. */
  refreshToken?(): Promise<string | null>;
  /** Called when a 401 could not be recovered by a refresh, e.g. to start a new login. */
  onAuthFailure?(): void;
  /** Adds context headers to every request, e.g. `X-Household-ID`. */
  prepareHeaders?(headers: Headers): void;
  /** Observes every non-2xx response before it is returned or thrown. */
  onErrorResponse?(response: Response): Promise<unknown>;
}

/** Options of `createApiClient`. Every field is optional; the defaults keep the original behaviour. */
export interface ApiClientOptions extends Omit<RequestInit, 'headers'> {
  /** Absolute base URL, used as is. Takes precedence over `basePath`. */
  baseUrl?: string;
  /**
   * API path on the Alfheim origin, e.g. `/api/v1/chat`. Resolved per request through
   * `resolveApiUrl` (runtime config, then `apiUrl`, then the current origin).
   */
  basePath?: string;
  /** Build-time API URL override for `basePath`, usually `process.env.NEXT_PUBLIC_API_URL`. */
  apiUrl?: string;
  /** Headers sent with every request. */
  headers?: HeadersInit;
  /** Fetch implementation. Defaults to the global `fetch`, looked up per request. */
  fetch?: typeof fetch;
  /** Request timeout in milliseconds (`AbortSignal.timeout`); `false` disables it. Default 8000. */
  timeoutMs?: number | false;
  /**
   * Attaches the signed-in session: bearer token, one refresh-and-retry on 401, household
   * headers and household error reporting. `true` uses `createBrowserApiSession()`.
   */
  session?: ApiSession | boolean;
  /** Rejects with a mapped error on non-2xx responses. Defaults to true with a session, else false. */
  throwHttpErrors?: boolean;
  /** Maps a failed response to the thrown error. Defaults to `defaultApiErrorMapper` (an `ApiError`). */
  mapError?: ApiErrorMapper;
}

/**
 * Query parameters of a request: an object (`undefined` and `null` values are left out), key-value
 * pairs for repeated keys, or `URLSearchParams`.
 */
export type ApiSearchParams =
  | URLSearchParams
  | Array<[string, string]>
  | Record<string, string | number | boolean | null | undefined>;

/** Per-request options: a `RequestInit` plus overrides of the client defaults. */
export interface ApiRequestInit extends RequestInit {
  /** Appended to the URL as a query string. */
  searchParams?: ApiSearchParams;
  /** Overrides the client timeout for this request. */
  timeoutMs?: number | false;
  /**
   * Marks a long-lived streaming request (e.g. Server-Sent Events): no timeout is applied and
   * the caller reads the body itself.
   */
  stream?: boolean;
  /** Overrides the client `throwHttpErrors` for this request. */
  throwHttpErrors?: boolean;
}

/** The pending response of a client call, with shortcuts to read the body. */
export interface ApiResponsePromise extends Promise<Response> {
  /** Parses the body as JSON; resolves to undefined for 204 No Content. */
  json<T>(): Promise<T>;
  /** Reads the body as text. */
  text(): Promise<string>;
}
