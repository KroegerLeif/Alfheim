import { createApiClient, parseApiErrorBody } from "@alfheim/shared";

/** A failed chores API call: status, backend error code and the server message (may be empty). */
export interface ApiError extends Error {
  status?: number;
  /** Backend error code, e.g. `household_role_forbidden`. */
  code?: string;
  message: string;
}

/** Maps a failed response to {@link ApiError}; an empty message lets the UI use its localized text. */
function toApiError(response: Response, body: unknown): ApiError {
  const parsed = body && typeof body === "object" ? parseApiErrorBody(body) : null;
  const message = parsed ? parsed.message || "" : response.statusText || "";
  return Object.assign(new Error(message), { status: response.status, code: parsed?.code ?? undefined });
}

/** Chores API client: the shared client with the browser session, paths relative to the chores API. */
export const choresClient = createApiClient({
  basePath: "/api/v1/chores",
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  session: true,
  timeoutMs: 10000,
  mapError: toApiError,
});
