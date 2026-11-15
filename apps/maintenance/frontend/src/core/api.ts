import { createApiClient, parseApiErrorBody, resolveFrontendUrl } from "@alfheim/shared";

/** A failed API call: status, backend error code and the server message or an i18n key. */
export interface ApiError extends Error {
  status?: number;
  /** Backend error code, e.g. `household_role_forbidden`. */
  code?: string;
  message: string;
}

/** Shown when the server sent no usable message; the UI translates it. */
const UNRECOGNIZED_ERROR = "maintenance.error.unrecognized_error";

/** Maps a failed response to {@link ApiError}. */
function toApiError(response: Response, body: unknown): ApiError {
  const parsed = body && typeof body === "object" ? parseApiErrorBody(body) : null;
  const message = parsed ? parsed.message || UNRECOGNIZED_ERROR : response.statusText || UNRECOGNIZED_ERROR;
  return Object.assign(new Error(message), { status: response.status, code: parsed?.code ?? undefined });
}

/** Maintenance API client: the shared client with the browser session, paths relative to the maintenance API. */
export const maintenanceClient = createApiClient({
  basePath: "/api/v1/maintenance",
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  session: true,
  timeoutMs: 10000,
  mapError: toApiError,
});

/**
 * Public API of the shopping app, reached on the frontend origin (never through another app's database
 * network). The shopping frontend uses the same `/shopping/api/v1` ingress prefix, which Caddy forwards to
 * the shopping backend as `/api/v1`. The runtime `API_URL` only describes this app's own API, so it is
 * deliberately not consulted here.
 */
export const shoppingClient = createApiClient({
  baseUrl: (typeof window !== "undefined" ? window.location.origin : resolveFrontendUrl()) + "/shopping/api/v1",
  session: true,
  timeoutMs: 10000,
  mapError: toApiError,
});
