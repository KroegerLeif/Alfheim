import type { ApiErrorPayload } from "@/features/conversations/types";

export interface KeycloakWindow extends Window {
  __keycloak_instance__?: {
    token?: string;
    authenticated?: boolean;
    updateToken?: (minValidity?: number) => Promise<boolean>;
    login?: (options?: unknown) => Promise<void> | void;
  };
}

function getKeycloakInstance() {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as KeycloakWindow).__keycloak_instance__;
}

export function sanitizeUrl(url: string | undefined, defaultFallback: string): string {
  let resolved = url || defaultFallback;
  if (resolved.startsWith("/")) {
    if (typeof window !== "undefined") {
      resolved = window.location.origin + resolved;
    } else {
      resolved = (process.env.NEXT_PUBLIC_FRONTEND_URL || "http://alfheim.loegien.localhost") + resolved;
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
  if (typeof window === "undefined") return null;
  const keycloak = getKeycloakInstance();
  if (keycloak && typeof keycloak.updateToken === "function") {
    try {
      await keycloak.updateToken(30);
      if (typeof keycloak.token === "string") {
        sessionStorage.setItem("token_chat-frontend", keycloak.token);
        sessionStorage.setItem("alfheim_access_token", keycloak.token);
        return keycloak.token;
      }
    } catch (err) {
      console.warn("Keycloak token refresh failed:", err);
      if (keycloak.authenticated === false && typeof keycloak.login === "function") {
        keycloak.login();
      }
    }
  }
  return sessionStorage.getItem("token_chat-frontend") || sessionStorage.getItem("alfheim_access_token");
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("token_chat-frontend") || sessionStorage.getItem("alfheim_access_token");
}

export function getActiveHouseholdId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("alfheim_active_household_id");
}

export function authHeaders(): HeadersInit {
  const token = getAuthToken();
  const activeHouseholdId = getActiveHouseholdId();
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (activeHouseholdId) {
    headers["X-Household-ID"] = activeHouseholdId;
  }
  return headers;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || payload.error || `Request failed with status ${status}`);
    this.status = status;
    this.code = payload.error || "unknown_error";
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getFreshAuthToken();
  const activeHouseholdId = getActiveHouseholdId();
  const buildHeaders = (authToken: string | null) => ({
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(activeHouseholdId ? { "X-Household-ID": activeHouseholdId } : {}),
    ...(init?.headers as Record<string, string>),
  });

  let res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(token),
  });

  if (res.status === 401 && typeof window !== "undefined") {
    const keycloak = getKeycloakInstance();
    if (keycloak && typeof keycloak.updateToken === "function") {
      try {
        const refreshed = await keycloak.updateToken(-1);
        if (refreshed && typeof keycloak.token === "string") {
          sessionStorage.setItem("token_chat-frontend", keycloak.token);
          sessionStorage.setItem("alfheim_access_token", keycloak.token);
          res = await fetch(`${BASE_URL}${path}`, {
            ...init,
            headers: buildHeaders(keycloak.token),
          });
        }
      } catch (err) {
        console.warn("Keycloak token refresh failed on 401:", err);
        if (typeof keycloak.login === "function") {
          keycloak.login();
        }
      }
    }
  }

  if (!res.ok) {
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
