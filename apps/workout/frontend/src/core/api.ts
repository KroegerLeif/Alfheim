import ky from "ky";

export interface ApiError {
  status?: number;
  message: string;
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
  let resolved = url || defaultFallback;

  if (resolved.startsWith("/")) {
    if (typeof window !== "undefined") {
      resolved = window.location.origin + resolved;
    } else {
      resolved =
        (process.env.NEXT_PUBLIC_FRONTEND_URL || "http://alfheim.loegien.localhost") + resolved;
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
  "http://api.alfheim.loegien.localhost/workout/api/v1"
);

const handleResponseError = async (response: Response) => {
  let message = "workout.loadFailed";
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

export const workoutClient = ky.create({
  prefixUrl: BASE_URL,
  timeout: 10000,
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
          const keycloak = (window as any).__keycloak_instance__;
          if (keycloak && typeof keycloak.updateToken === "function") {
            try {
              const refreshed = await keycloak.updateToken(30);
              if (refreshed && keycloak.token) {
                sessionStorage.setItem("token_workout-frontend", keycloak.token);
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

export type apiClientType = typeof workoutClient;
