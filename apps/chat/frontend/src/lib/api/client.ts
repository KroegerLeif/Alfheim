import type { ApiErrorPayload } from "@/features/conversations/types";
import {
  resolveApiUrl,
  resolveFrontendUrl,
  LEGACY_ACCESS_TOKEN_KEY,
  getActiveHouseholdId,
  householdHeaders,
  parseApiErrorBody,
  reportHouseholdErrorResponse,
} from "@alfheim/shared";

export function sanitizeUrl(url: string | undefined, defaultFallback: string): string {
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
  return resolved;
}

export const BASE_URL = sanitizeUrl(
  process.env.NEXT_PUBLIC_API_URL,
  "/api/v1/chat"
);

export async function getFreshAuthToken(): Promise<string | null> {
  return getAuthToken();
}

/**
 * Asks the OIDC auth bridge to refresh the access token after a 401.
 * Returns the new access token, or null when no refresh is possible.
 */
async function refreshAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const bridge = window.__alfheim_oidc__;
  if (!bridge || typeof bridge.refresh !== "function") return null;
  try {
    return await bridge.refresh();
  } catch (err) {
    console.warn("OIDC token refresh failed on 401:", err);
    return null;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
}

export { getActiveHouseholdId };

/**
 * Auth + household headers for every chat API call (REST, SSE, uploads). The
 * chat backend requires X-Household-ID on all routes (400 household_required).
 */
export function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...householdHeaders(),
  };
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, payload: ApiErrorPayload) {
    // Also accepts the structured {"detail":{"code","message"}} contract.
    const parsed = parseApiErrorBody(payload);
    super(payload.message || parsed.message || payload.error || `Request failed with status ${status}`);
    this.status = status;
    this.code = payload.error || parsed.code || "unknown_error";
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getFreshAuthToken();
  const household = householdHeaders();
  const buildHeaders = (authToken: string | null) => ({
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...household,
    ...(init?.headers as Record<string, string>),
  });

  let res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(token),
  });

  if (res.status === 401) {
    const refreshed = await refreshAuthToken();
    if (refreshed) {
      res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: buildHeaders(refreshed),
      });
    }
  }

  if (!res.ok) {
    await reportHouseholdErrorResponse(res);
    let payload: ApiErrorPayload = { error: "unknown_error", message: `Request failed with status ${res.status}` };
    try {
      payload = await res.json();
    } catch {
      payload.message = res.statusText || payload.message;
    }
    throw new ApiError(res.status, payload);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
