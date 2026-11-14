import { createApiClient, parseApiErrorBody, resolveFrontendUrl } from "@alfheim/shared";

/** A failed API call: status, backend error code and the server message (may be empty). */
export interface ApiError extends Error {
  status?: number;
  /** Backend error code, e.g. `household_role_forbidden`. */
  code?: string;
  message: string;
}

/** Maps a failed response to {@link ApiError}; an empty message lets the UI show its localized text. */
function toApiError(response: Response, body: unknown): ApiError {
  const parsed = body && typeof body === "object" ? parseApiErrorBody(body) : null;
  const message = parsed ? parsed.message || "" : response.statusText;
  return Object.assign(new Error(message), { status: response.status, code: parsed?.code ?? undefined });
}

/** Shopping API client: the shared client with the browser session, paths relative to the shopping API. */
export const shoppingClient = createApiClient({
  basePath: "/shopping/api/v1",
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  session: true,
  timeoutMs: 10000,
  mapError: toApiError,
});

/**
 * Pantry API client. The runtime config (`window.__ALFHEIM_ENV__.API_URL`) carries only the shopping
 * API, so in the browser the pantry API is always reached on the same origin, where Caddy routes
 * `/pantry/api/v1*` to pantry-backend.
 */
export const pantryClient = createApiClient({
  baseUrl:
    typeof window !== "undefined"
      ? `${window.location.origin}/pantry/api/v1`
      : (process.env.NEXT_PUBLIC_PANTRY_API_URL || `${resolveFrontendUrl()}/pantry/api/v1`)
          .replace(/\/+$/, "")
          .replace(/(\/api\/v1)?$/, "/api/v1"),
  session: true,
  timeoutMs: 10000,
  mapError: toApiError,
});
