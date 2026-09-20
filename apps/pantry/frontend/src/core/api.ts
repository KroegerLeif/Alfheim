import ky from "ky";
import {
  resolveApiUrl,
  resolveFrontendUrl,
  LEGACY_ACCESS_TOKEN_KEY,
  applyHouseholdHeaders,
  reportHouseholdErrorResponse,
} from "@alfheim/shared";

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

const BASE_URL = sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, "/pantry/api/v1");

export const pantryClient = ky.create({
  prefixUrl: BASE_URL,
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
      },
    ],
  },
});
export type apiClientType = typeof pantryClient;
