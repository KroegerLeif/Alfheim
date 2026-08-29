import ky from "ky";

const sanitizeUrl = (url: string | undefined, defaultFallback: string) => {
  let resolved = url || defaultFallback;
  if (resolved.startsWith("/")) {
    if (typeof window !== "undefined") {
      resolved = window.location.origin + resolved;
    } else {
      resolved =
        (process.env.NEXT_PUBLIC_FRONTEND_URL ||
          "http://alfheim.loegien.localhost") + resolved;
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
  "http://api.alfheim.loegien.localhost/api/v1/library"
);

export const libraryClient = ky.create({
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
            sessionStorage.getItem("token_library-frontend") ||
            sessionStorage.getItem("alfheim_access_token");
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
          const activeHhId = localStorage.getItem(
            "alfheim_active_household_id"
          );
          if (activeHhId) {
            request.headers.set("X-Household-ID", activeHhId);
          }
        }
      },
    ],
  },
});
