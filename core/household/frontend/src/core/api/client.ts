import ky from 'ky';
import { resolveApiUrl, resolveFrontendUrl, LEGACY_ACCESS_TOKEN_KEY } from '@alfheim/shared';

// Sanitize and resolve base host URLs to bypass client-side path mutations
const sanitizeBaseUrl = (url: string | undefined) => {
  let resolved = resolveApiUrl('/api/v1', url);
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
  // Strip trailing /api/v1 if present because all requests specify api/v1/ prefix
  if (resolved.endsWith("/api/v1")) {
    resolved = resolved.slice(0, -7);
  }
  return resolved + "/";
};

const BASE_URL = sanitizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);

/**
 * Get the Bearer auth token dynamically from the shared session-storage-backed
 * token store written by the OIDC auth module (packages/shared/src/features/auth).
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
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
          const oidc = window.__alfheim_oidc__;
          if (oidc && typeof oidc.refresh === "function") {
            try {
              const refreshedToken = await oidc.refresh();
              if (refreshedToken) {
                // The shared OIDC module already persisted the refreshed token to
                // sessionStorage; only the in-flight request header needs updating.
                request.headers.set('Authorization', `Bearer ${refreshedToken}`);
                return ky(request);
              }
              if (typeof oidc.login === "function") {
                oidc.login();
              }
            } catch (err) {
              console.warn("OIDC token refresh failed on 401:", err);
              if (typeof oidc.login === "function") {
                oidc.login();
              }
            }
          }
        }
      }
    ],
  },
});
