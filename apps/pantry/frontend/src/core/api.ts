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

/** Creates a ky client that carries the bearer token and household headers and handles 401 refresh. */
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
        },
      ],
    },
  });

export const pantryClient = createApiClient(BASE_URL);
export type apiClientType = typeof pantryClient;

/**
 * Public API of the shopping app, reached on the frontend origin (never through another app's database
 * network). The shopping frontend uses the same `/shopping/api/v1` ingress prefix, which Caddy forwards
 * to the shopping backend as `/api/v1`, so items are added with `POST shopping/items`. The runtime
 * `API_URL` only describes this app's own API, so it is deliberately not consulted here.
 */
const SHOPPING_API_URL =
  (typeof window !== "undefined" ? window.location.origin : resolveFrontendUrl()) + "/shopping/api/v1/";

export const shoppingClient = createApiClient(SHOPPING_API_URL);
