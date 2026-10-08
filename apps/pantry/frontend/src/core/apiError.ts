import { HTTPError } from "ky";
import { parseApiErrorBody } from "@alfheim/shared";

/** Longest server message that is shown to the user; longer bodies (stack dumps) are cut. */
const MAX_DETAIL_LENGTH = 300;

/** Structured view of a failed Pantry API call. */
export interface ApiErrorInfo {
  /** HTTP status, or null when the request never produced a response (network error, timeout). */
  status: number | null;
  /** Stable machine-readable error code from `{"detail": {"code"}}`, or null. */
  code: string | null;
  /** Number of dependent records reported with `*_in_use` conflicts. */
  itemCount: number | null;
  /** English server message (string detail, structured message or validation messages), or null. */
  detail: string | null;
}

/** Joins the `msg` entries of a FastAPI validation error (`detail: [{loc, msg}]`). */
function validationMessages(detail: unknown): string | null {
  if (!Array.isArray(detail)) return null;
  const messages = detail
    .map((entry) => (entry && typeof (entry as { msg?: unknown }).msg === "string" ? (entry as { msg: string }).msg : null))
    .filter((msg): msg is string => msg !== null)
    .map((msg) => msg.replace(/^Value error,\s*/, ""));
  return messages.length > 0 ? messages.join("; ") : null;
}

/**
 * Extract status, stable code and server message from a ky failure so callers can show a localized
 * message and still surface what the server said.
 */
export async function readApiError(error: unknown): Promise<ApiErrorInfo> {
  if (!(error instanceof HTTPError)) {
    return { status: null, code: null, itemCount: null, detail: null };
  }

  const info: ApiErrorInfo = { status: error.response.status, code: null, itemCount: null, detail: null };
  try {
    const body: unknown = await error.response.clone().json();
    const parsed = parseApiErrorBody(body);
    const rawDetail = (body as { detail?: unknown } | null)?.detail;
    info.code = parsed.code;
    info.detail = parsed.message ?? validationMessages(rawDetail);
    if (rawDetail && typeof rawDetail === "object" && !Array.isArray(rawDetail)) {
      const count = (rawDetail as { item_count?: unknown }).item_count;
      info.itemCount = typeof count === "number" ? count : null;
    }
  } catch {
    // The body is not JSON (for example a proxy error page); the status alone is still useful.
  }
  if (info.detail && info.detail.length > MAX_DETAIL_LENGTH) {
    info.detail = `${info.detail.slice(0, MAX_DETAIL_LENGTH)}…`;
  }
  return info;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface DescribeOptions {
  /** Maps stable backend error codes to translation keys; the key receives `{count}`. */
  codeKeys?: Record<string, string>;
}

/**
 * Build the localized message for a failed request: a known error code maps to its own message,
 * anything else is the localized `fallbackKey` followed by the server detail (or a hint that the
 * server could not be reached).
 */
export async function describeApiError(
  error: unknown,
  t: Translate,
  fallbackKey: string,
  { codeKeys = {} }: DescribeOptions = {}
): Promise<string> {
  const info = await readApiError(error);
  const codeKey = info.code ? codeKeys[info.code] : undefined;
  if (codeKey) return t(codeKey, { count: info.itemCount ?? 0 });

  const base = t(fallbackKey);
  if (info.status === null) return `${base} ${t("pantry.errors.unreachable")}`;
  return info.detail ? `${base} ${info.detail}` : base;
}
