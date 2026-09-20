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

const BASE_URL = sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, "/api/v1/chores");

const handleResponseError = async (response: Response) => {
  let code: string | undefined;
  let message = "chores.error.unrecognized_error";
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

export const choresClient = ky.create({
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
        if (!response.ok) {
          await handleResponseError(response);
        }
      },
    ],
  },
});
export type apiClientType = typeof choresClient;
