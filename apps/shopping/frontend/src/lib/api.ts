import ky from "ky";
import {
  resolveApiUrl,
  resolveFrontendUrl,
  LEGACY_ACCESS_TOKEN_KEY,
  applyHouseholdHeaders,
  reportHouseholdErrorResponse,
  parseApiErrorBody,
} from "@alfheim/shared";

export interface ApiError {
  status?: number;
  /** Backend error code, e.g. `household_role_forbidden`. */
  code?: string;
  message: string;
}

// Sanitize and resolve base host URLs to bypass client-side path mutations
const sanitizeUrl = (url: string | undefined, defaultFallback: string) => {
  let resolved = resolveApiUrl(defaultFallback, url);
  if (resolved.startsWith("/")) {
    if (typeof window !== "undefined") {
      resolved = window.location.origin + resolved;
    } else {
      resolved = resolveFrontendUrl() + resolved;
    }
  }
  if (resolved.endsWith("/")) {
    resolved = resolved.slice(0, -1);
  }
  if (resolved.endsWith("/api/v1")) {
    resolved = resolved.slice(0, -7);
  }
  return resolved + "/";
};

const SHOPPING_API_URL = sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, "/shopping/api/v1");
// The runtime config (window.__ALFHEIM_ENV__.API_URL) carries only the
// shopping API, and resolveApiUrl prefers it over any argument. In the browser
// the pantry API is therefore always reached on the same origin, where Caddy
// routes /pantry/api/v1* to pantry-backend.
const PANTRY_API_URL =
  typeof window !== "undefined"
    ? `${window.location.origin}/pantry/`
    : sanitizeUrl(process.env.NEXT_PUBLIC_PANTRY_API_URL, "/pantry/api/v1");

/**
 * Normalizes HTTP error payloads from FastAPI and throws custom ApiError objects.
 */
const handleResponseError = async (response: Response) => {
  let code: string | undefined;
  let message = "shopping.error.unrecognized_error";
  try {
    const data = await response.json();
    // Plain FastAPI detail strings and the structured {"detail":{"code","message"}} contract
    const parsed = parseApiErrorBody(data);
    code = parsed.code ?? undefined;
    message = parsed.message || message;
  } catch {
    // Fallback if response body is not JSON
    message = response.statusText || message;
  }

  throw {
    status: response.status,
    code,
    message,
  } as ApiError;
};

const beforeRequestHook = (request: Request) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    applyHouseholdHeaders(request.headers);
  }
};

/**
 * Retries a request once through the OIDC refresh bridge after a 401, otherwise
 * normalizes the error via handleResponseError.
 */
const afterResponseHook = async (
  request: Request,
  options: Parameters<typeof ky>[1],
  response: Response
) => {
  if (response.status === 401 && typeof window !== "undefined") {
    const oidcBridge = window.__alfheim_oidc__;
    if (oidcBridge && typeof oidcBridge.refresh === "function") {
      try {
        const newToken = await oidcBridge.refresh();
        if (newToken) {
          request.headers.set("Authorization", `Bearer ${newToken}`);
          return ky(request, options);
        }
      } catch (err) {
        console.warn("OIDC token refresh failed on 401:", err);
      }
    }
  }
  await reportHouseholdErrorResponse(response);
  if (!response.ok) {
    await handleResponseError(response);
  }
};

// --- Shopping Backend API Client ---
export const shoppingClient = ky.create({
  prefixUrl: SHOPPING_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [beforeRequestHook],
    afterResponse: [afterResponseHook],
  },
});

// --- Pantry Backend API Client ---
export const pantryClient = ky.create({
  prefixUrl: PANTRY_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [beforeRequestHook],
    afterResponse: [afterResponseHook],
  },
});
