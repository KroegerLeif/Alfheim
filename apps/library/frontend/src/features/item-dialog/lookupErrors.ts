import { ApiErrorInfo } from "@/core/apiError";

/** Backend error code for a lookup source that has no API key configured. */
export const LOOKUP_NOT_CONFIGURED_CODE = "lookup_not_configured";

/**
 * Map a failed metadata lookup to the translation key explaining it: invalid query (400), no
 * results (404), unconfigured source (502 with a stable code) or a source that is unreachable.
 */
export function getLookupErrorKey(error: ApiErrorInfo): string {
  if (error.status === 400) return "library.itemDialog.lookupInvalid";
  if (error.status === 404) return "library.itemDialog.lookupNoResults";
  if (error.code === LOOKUP_NOT_CONFIGURED_CODE) return "library.itemDialog.lookupNotConfigured";
  return "library.itemDialog.lookupUnavailable";
}
