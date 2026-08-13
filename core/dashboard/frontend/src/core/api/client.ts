import ky from 'ky';
import { getInMemoryToken, setInMemoryToken } from '@/core/providers/AuthProvider';

// Sanitize and resolve base host URLs to bypass client-side path mutations
const sanitizeBaseUrl = (url: string | undefined, defaultFallback: string) => {
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
  // Strip trailing /api/v1 if present because all requests specify api/v1/ prefix
  if (resolved.endsWith("/api/v1")) {
    resolved = resolved.slice(0, -7);
  }
  return resolved + "/";
};

const BASE_URL = sanitizeBaseUrl(process.env.NEXT_PUBLIC_API_URL, 'http://api.alfheim.loegien.localhost/api/v1');

/**
 * Get Bearer auth token dynamically from in-memory AuthProvider state.
 */
function getAuthToken(): string | null {
  return getInMemoryToken();
}

/**
 * Centralized HTTP client using `ky`.
 * Features automatic Bearer token injection, active household context headers, and token refresh.
 */
export const api = ky.create({
  prefix: BASE_URL,
  timeout: 8000,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = getAuthToken();
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
        if (typeof window !== "undefined") {
          const activeHhId = localStorage.getItem("alfheim_active_household_id");
          if (activeHhId) {
            request.headers.set("X-Household-ID", activeHhId);
          }
          const activeRole = localStorage.getItem("alfheim_active_household_role");
          if (activeRole) {
            request.headers.set("X-Household-Role", activeRole);
          }
        }
      },
    ],
    afterResponse: [
      async ({ request, response }) => {
        if (response.status === 401 && typeof window !== "undefined") {
          const keycloak = (window as any).__keycloak_instance__;
          if (keycloak && typeof keycloak.updateToken === "function") {
            try {
              const refreshed = await keycloak.updateToken(30);
              if (refreshed && keycloak.token) {
                setInMemoryToken(keycloak.token);
                request.headers.set('Authorization', `Bearer ${keycloak.token}`);
                return ky(request);
              }
            } catch (err) {
              console.warn("Keycloak token refresh failed on 401:", err);
              if (typeof keycloak.login === "function") {
                keycloak.login();
              }
            }
          }
        }
      }
    ],
  },
});
