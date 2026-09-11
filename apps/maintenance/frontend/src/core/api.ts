import ky from "ky";
import { resolveApiUrl, resolveFrontendUrl } from "@alfheim/shared";

export interface ApiError {
  status?: number;
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
  let message = "maintenance.error.unrecognized_error";
  try {
    const data = await response.json();
    message = data?.detail || data?.message || message;
  } catch {
    message = response.statusText || message;
  }

  throw {
    status: response.status,
    message,
  } as ApiError;
};

// --- Maintenance Backend API Client ---
export const maintenanceClient = ky.create({
  prefixUrl: MAINTENANCE_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window !== "undefined") {
          const token = sessionStorage.getItem("token_maintenance-frontend") || sessionStorage.getItem("alfheim_access_token");
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
          const activeHhId = localStorage.getItem("alfheim_active_household_id");
          if (activeHhId) {
            request.headers.set("X-Household-ID", activeHhId);
          }
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
        if (!response.ok) {
          await handleResponseError(response);
        }
      },
    ],
  },
});
