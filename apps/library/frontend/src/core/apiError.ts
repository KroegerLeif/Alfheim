import { HTTPError } from "ky";

/** Structured view of a failed Library API call: `{"detail": {"code", "message", ...}}`. */
export interface ApiErrorInfo {
  /** HTTP status, or null when the request never produced a response (network error, timeout). */
  status: number | null;
  /** Stable machine-readable error code, or null when the body does not carry one. */
  code: string | null;
  /** Number of dependent items reported with `*_in_use` conflicts. */
  itemCount: number | null;
}

/**
 * Extract status and stable error code from a ky failure so callers can show a localized message
 * instead of the raw English text of the HTTP error.
 */
export async function readApiError(error: unknown): Promise<ApiErrorInfo> {
  if (!(error instanceof HTTPError)) {
    return { status: null, code: null, itemCount: null };
  }

  const info: ApiErrorInfo = { status: error.response.status, code: null, itemCount: null };
  try {
    const body: unknown = await error.response.clone().json();
    const detail = (body as { detail?: unknown } | null)?.detail;
    if (detail && typeof detail === "object") {
      const { code, item_count: itemCount } = detail as { code?: unknown; item_count?: unknown };
      info.code = typeof code === "string" ? code : null;
      info.itemCount = typeof itemCount === "number" ? itemCount : null;
    }
  } catch {
    // The body is not JSON (for example a proxy error page); the status alone is still useful.
  }
  return info;
}
