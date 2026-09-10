import ky from "ky";
import { createTraceparentHook, resolveApiUrl, resolveFrontendUrl } from "@alfheim/shared";

export class ApiError extends Error {
  status?: number;
  constructor(status: number | undefined, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
  "/budget/api/v1"
);

const handleResponseError = async (response: Response) => {
  let message = "budget.requestFailed";
  try {
    const data = await response.json();
    message = data?.detail || data?.message || message;
  } catch {
    message = response.statusText || message;
  }
  throw new ApiError(response.status, message);
};

export const budgetClient = ky.create({
  prefixUrl: BASE_URL,
  timeout: 10000,
  retry: 0,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      createTraceparentHook(),
      (request) => {
        if (typeof window !== "undefined") {
          const token =
            sessionStorage.getItem("token_budget-frontend") ||
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
      async (_request, _options, response) => {
        if (!response.ok) {
          await handleResponseError(response);
        }
      },
    ],
  },
});

export type apiClientType = typeof budgetClient;
