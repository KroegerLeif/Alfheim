import ky from "ky";

// Sanitize and resolve base host URLs to bypass client-side path mutations
const sanitizeUrl = (url: string | undefined, defaultFallback: string) => {
  let resolved = url || defaultFallback;
  if (resolved.startsWith("/")) {
    if (typeof window !== "undefined") {
      resolved = window.location.origin + resolved;
    } else {
      resolved = "http://alfheim" + resolved;
    }
  }
  return resolved.endsWith("/") ? resolved : resolved + "/";
};

const BASE_URL = sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, "http://alfheim/api/v1/pantry/");

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
          const token = sessionStorage.getItem("token_pantry-frontend");
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
          const activeHhId = localStorage.getItem("alfheim_active_household_id");
          if (activeHhId) {
            request.headers.set("X-Household-ID", activeHhId);
          }
        }
      },
    ],
  },
});
export type apiClientType = typeof pantryClient;
