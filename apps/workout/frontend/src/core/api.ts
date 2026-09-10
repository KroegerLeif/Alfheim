import ky from "ky";
import { resolveApiUrl, resolveFrontendUrl } from "@alfheim/shared";

export class ApiError extends Error {
  status?: number;
  constructor(status: number | undefined, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Normalize NEXT_PUBLIC_API_URL into a ky prefixUrl.
 *
 * The Caddy gateway strips the `/workout` prefix and the backend mounts every
 * router at `/api/v1/...`, so the configured URL ends in `/api/v1`. That tail is
 * removed here and re-supplied by each call site (`workoutClient.get("api/v1/plans")`),
 * which keeps request paths readable and matches the pantry convention.
 */
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

const BASE_URL = sanitizeUrl(
  process.env.NEXT_PUBLIC_API_URL,
  "/workout/api/v1"
);

const handleResponseError = async (response: Response) => {
  let message = "workout.loadFailed";
  try {
    const data = await response.json();
    message = data?.detail || data?.message || message;
  } catch {
    message = response.statusText || message;
  }

  throw new ApiError(response.status, message);
};

export const workoutClient = ky.create({
  prefixUrl: BASE_URL,
  timeout: 10000,
  retry: 0,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window !== "undefined") {
          const token =
            sessionStorage.getItem("token_workout-frontend") ||
            sessionStorage.getItem("alfheim_access_token");
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
          const activeHouseholdId = localStorage.getItem("alfheim_active_household_id");
          if (activeHouseholdId) {
            request.headers.set("X-Household-ID", activeHouseholdId);
          }
        }
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        // Refresh once on 401 and replay, so a token that expired mid-workout
        // does not surface as a failed set log.
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

export type apiClientType = typeof workoutClient;
