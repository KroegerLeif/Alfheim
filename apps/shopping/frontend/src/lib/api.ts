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
  if (resolved.endsWith("/")) {
    resolved = resolved.slice(0, -1);
  }
  if (resolved.endsWith("/api/v1")) {
    resolved = resolved.slice(0, -7);
  }
  return resolved + "/";
};

const SHOPPING_API_URL = sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, "/shopping/api/v1");
const PANTRY_API_URL = sanitizeUrl(process.env.NEXT_PUBLIC_PANTRY_API_URL, "/pantry/api/v1");

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

const beforeRequestHook = (request: Request) => {
  if (typeof window !== "undefined") {
    const token = sessionStorage.getItem("token_shopping-frontend") || sessionStorage.getItem("alfheim_access_token");
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    const activeHhId = localStorage.getItem("alfheim_active_household_id");
    if (activeHhId) {
      request.headers.set("X-Household-ID", activeHhId);
    }
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
