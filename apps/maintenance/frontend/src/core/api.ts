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
  return resolved.endsWith("/") ? resolved : resolved + "/";
};

const MAINTENANCE_API_URL = sanitizeUrl(
  process.env.NEXT_PUBLIC_API_URL,
  "/api/v1/maintenance"
);

/**
 * Normalizes HTTP error payloads from FastAPI and throws custom ApiError objects.
 */
const handleResponseError = async (response: Response) => {
  let code: string | undefined;
  let message = "maintenance.error.unrecognized_error";
  try {
    const data = await response.json();
    // Plain FastAPI detail strings and the structured {"detail":{"code","message"}} contract
    const parsed = parseApiErrorBody(data);
    code = parsed.code ?? undefined;
    message = parsed.message || message;
  } catch {
    message = response.statusText || message;
  }

  throw {
    status: response.status,
    code,
    message,
  } as ApiError;
};

/** Creates a ky client that carries the bearer token and household headers and normalizes API errors. */
const createApiClient = (prefixUrl: string) =>
  ky.create({
    prefixUrl,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
    hooks: {
      beforeRequest: [
        (request) => {
          if (typeof window !== "undefined") {
            const token = sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
            if (token) {
              request.headers.set("Authorization", `Bearer ${token}`);
            }
            applyHouseholdHeaders(request.headers);
          }
        },
      ],
      afterResponse: [
        async (request, options, response) => {
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
        },
      ],
    },
  });

// --- Maintenance Backend API Client ---
export const maintenanceClient = createApiClient(MAINTENANCE_API_URL);

/**
 * Public API of the shopping app, reached on the frontend origin (never through another app's database
 * network). The shopping frontend uses the same `/shopping/api/v1` ingress prefix, which Caddy forwards to
 * the shopping backend as `/api/v1`. The runtime `API_URL` only describes this app's own API, so it is
 * deliberately not consulted here.
 */
const SHOPPING_API_URL =
  (typeof window !== "undefined" ? window.location.origin : resolveFrontendUrl()) + "/shopping/api/v1/";

// --- Shopping Backend API Client ---
export const shoppingClient = createApiClient(SHOPPING_API_URL);
