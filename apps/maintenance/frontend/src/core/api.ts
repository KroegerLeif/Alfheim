import ky from "ky";

export interface ApiError {
  status?: number;
  message: string;
}

// Sanitize and resolve base host URLs to bypass client-side path mutations
const sanitizeUrl = (url: string | undefined, defaultFallback: string) => {
  let resolved = url || defaultFallback;
  if (resolved.startsWith("/")) {
    if (typeof window !== "undefined") {
      resolved = window.location.origin + resolved;
    } else {
      resolved = (process.env.NEXT_PUBLIC_FRONTEND_URL || "http://alfheim.loegien.localhost") + resolved;
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

const MAINTENANCE_API_URL = sanitizeUrl(
  process.env.NEXT_PUBLIC_API_URL,
  "http://api.alfheim.loegien.localhost/maintenance/api/v1"
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
          const keycloak = (window as any).__keycloak_instance__;
          if (keycloak && typeof keycloak.updateToken === "function") {
            try {
              const refreshed = await keycloak.updateToken(30);
              if (refreshed && keycloak.token) {
                sessionStorage.setItem("token_maintenance-frontend", keycloak.token);
                sessionStorage.setItem("alfheim_access_token", keycloak.token);
                request.headers.set("Authorization", `Bearer ${keycloak.token}`);
                return ky(request, options);
              }
            } catch (err) {
              console.warn("Keycloak token refresh failed on 401:", err);
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
