import { createApiClient, parseApiErrorBody } from "@alfheim/shared";

/** A non-2xx budget API response; `message` is empty when the server sent no usable text. */
export class ApiError extends Error {
  status?: number;
  /** Backend error code, e.g. `household_role_forbidden`. */
  code?: string;
  constructor(status: number | undefined, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Maps a failed response to {@link ApiError}, so the UI can fall back to its localized text. */
function toApiError(response: Response, body: unknown): ApiError {
  if (body && typeof body === "object") {
    const parsed = parseApiErrorBody(body);
    return new ApiError(response.status, parsed.message || "", parsed.code ?? undefined);
  }
  return new ApiError(response.status, response.statusText || "");
}

/** Budget API client: the shared client with the browser session, paths relative to the budget API. */
export const budgetClient = createApiClient({
  basePath: "/api/v1/budget",
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  session: true,
  timeoutMs: 10000,
  mapError: toApiError,
});
