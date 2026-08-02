import ky from 'ky';
import {
  AppCatalogResponse,
  AppItem,
  CreateAppRequest,
  UserProfile,
  UpdateProfileRequest,
  Household,
  CreateHouseholdRequest,
  CreateInviteRequest,
  InviteCodeResponse,
  JoinHouseholdRequest,
  TelemetryMetrics,
  TelemetryLogEntry,
  TelemetryLogsResponse,
} from './types';
import { getInMemoryToken, setInMemoryToken } from './providers/AuthProvider';

// Sanitize and resolve base host URLs to bypass client-side path mutations
const sanitizeBaseUrl = (url: string | undefined, defaultFallback: string) => {
  let resolved = url || defaultFallback;
  if (resolved.startsWith("/")) {
    if (typeof window !== "undefined") {
      resolved = window.location.origin + resolved;
    } else {
      resolved = "http://loeger-os" + resolved;
    }
  }
  if (resolved.endsWith("/")) {
    resolved = resolved.slice(0, -1);
  }
  // Strip trailing /api/v1 if present because all requests specify api/v1/ prefix
  if (resolved.endsWith("/api/v1")) {
    resolved = resolved.slice(0, -7);
  }
  return resolved + "/";
};

const BASE_URL = sanitizeBaseUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:8080');

/**
 * Get Bearer auth token dynamically from in-memory AuthProvider state.
 */
function getAuthToken(): string | null {
  return getInMemoryToken();
}

/**
 * Centralized HTTP client using `ky`.
 * Features automatic Bearer token injection and configurable timeout.
 */
export const api = ky.create({
  prefixUrl: BASE_URL,
  timeout: 8000,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = getAuthToken();
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401 && typeof window !== "undefined") {
          const keycloak = (window as any).__keycloak_instance__;
          if (keycloak && typeof keycloak.updateToken === "function") {
            try {
              const refreshed = await keycloak.updateToken(30);
              if (refreshed && keycloak.token) {
                setInMemoryToken(keycloak.token);
                request.headers.set('Authorization', `Bearer ${keycloak.token}`);
                return ky(request);
              }
            } catch (err) {
              console.warn("Keycloak token refresh failed on 401:", err);
              if (typeof keycloak.login === "function") {
                keycloak.login();
              }
            }
          }
        }
      }
    ],
  },
});

/* API Fetcher Functions */

export async function fetchAppCatalog(): Promise<AppCatalogResponse> {
  return await api.get('api/v1/apps').json<AppCatalogResponse>();
}

export async function createApp(payload: CreateAppRequest): Promise<AppItem> {
  return await api.post('api/v1/apps', { json: payload }).json<AppItem>();
}

export async function updateApp(id: string, payload: Partial<CreateAppRequest>): Promise<AppItem> {
  return await api.put(`api/v1/apps/${id}`, { json: payload }).json<AppItem>();
}

export async function fetchUserProfile(): Promise<UserProfile> {
  return await api.get('api/v1/profile/me').json<UserProfile>();
}

export async function updateUserProfile(payload: UpdateProfileRequest): Promise<UserProfile> {
  return await api.put('api/v1/profile/me', { json: payload }).json<UserProfile>();
}

export async function fetchHouseholds(): Promise<Household[]> {
  return await api.get('api/v1/households/me').json<Household[]>();
}

export async function createHousehold(payload: CreateHouseholdRequest): Promise<Household> {
  const slug = payload.slug || payload.name.toLowerCase().replace(/\s+/g, '-');
  return await api.post('api/v1/households', { json: { name: payload.name, slug } }).json<Household>();
}

export async function createHouseholdInvite(payload: CreateInviteRequest): Promise<InviteCodeResponse> {
  return await api.post('api/v1/households/invite', { json: payload }).json<InviteCodeResponse>();
}

export async function joinHousehold(payload: JoinHouseholdRequest): Promise<Household> {
  return await api.post('api/v1/households/join', { json: payload }).json<Household>();
}

export async function fetchTelemetryMetrics(): Promise<TelemetryMetrics> {
  try {
    return await api.get('api/v1/telemetry/metrics').json<TelemetryMetrics>();
  } catch {
    // Attempt backward compatibility endpoint
    return await api.get('api/v1/telemetry').json<TelemetryMetrics>();
  }
}

export async function fetchTelemetryLogs(): Promise<TelemetryLogEntry[]> {
  try {
    const res = await api.get('api/v1/telemetry/logs').json<TelemetryLogsResponse>();
    return res.logs;
  } catch {
    return [];
  }
}
