import ky, { HTTPError } from "ky";

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
      resolved = "http://loeger-os" + resolved;
    }
  }
  return resolved.endsWith("/") ? resolved : resolved + "/";
};

const SHOPPING_API_URL = sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, "http://loeger-os/api/v1/shopping/");
const PANTRY_API_URL = sanitizeUrl(process.env.NEXT_PUBLIC_PANTRY_API_URL, "http://loeger-os/api/v1/pantry/");

/**
 * Normalizes HTTP error payloads from FastAPI and throws custom ApiError objects.
 */
const handleResponseError = async (response: Response) => {
  let message = "shopping.error.unrecognized_error";
  try {
    const data = await response.json();
    // Support FastAPI standard details or direct translatable strings
    message = data?.detail || data?.message || message;
  } catch {
    // Fallback if response body is not JSON
    message = response.statusText || message;
  }

  throw {
    status: response.status,
    message,
  } as ApiError;
};

// --- Shopping Backend API Client ---
export const shoppingClient = ky.create({
  prefixUrl: SHOPPING_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window !== "undefined") {
          const token = sessionStorage.getItem("token_shopping-frontend");
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
          const activeHhId = localStorage.getItem("loeger_os_active_household_id");
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
                sessionStorage.setItem("token_shopping-frontend", keycloak.token);
              }
            } catch (err) {
              console.warn("Keycloak token refresh failed on 401:", err);
              if (typeof keycloak.login === "function") {
                keycloak.login();
              }
            }
          }
          await handleResponseError(response);
        } else if (!response.ok) {
          await handleResponseError(response);
        }
      },
    ],
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
    beforeRequest: [
      (request) => {
        if (typeof window !== "undefined") {
          const token = sessionStorage.getItem("token_shopping-frontend");
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
          const activeHhId = localStorage.getItem("loeger_os_active_household_id");
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
                sessionStorage.setItem("token_shopping-frontend", keycloak.token);
              }
            } catch (err) {
              console.warn("Keycloak token refresh failed on 401:", err);
              if (typeof keycloak.login === "function") {
                keycloak.login();
              }
            }
          }
          await handleResponseError(response);
        } else if (!response.ok) {
          await handleResponseError(response);
        }
      },
    ],
  },
});
