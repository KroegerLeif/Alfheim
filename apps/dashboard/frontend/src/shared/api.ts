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
  ContactCategory,
  Contact,
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
  prefix: BASE_URL,
  timeout: 8000,
  hooks: {
    beforeRequest: [
      ({ request }) => {
        const token = getAuthToken();
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
        if (typeof window !== "undefined") {
          const activeHhId = localStorage.getItem("loeger_os_active_household_id");
          if (activeHhId) {
            request.headers.set("X-Household-ID", activeHhId);
          }
          const activeRole = localStorage.getItem("loeger_os_active_household_role");
          if (activeRole) {
            request.headers.set("X-Household-Role", activeRole);
          }
        }
      },
    ],
    afterResponse: [
      async ({ request, response }) => {
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

/* Address API */
export async function updateHouseholdAddress(
  id: string,
  payload: { street: string; zip: string; city: string; country: string; latitude: number | null; longitude: number | null }
): Promise<any> {
  return await api.put(`api/v1/households/${id}/address`, { json: payload }).json();
}

/* Member Management API */
export async function updateMemberRole(householdId: string, userId: string, role: string): Promise<any> {
  return await api.put(`api/v1/households/${householdId}/members/${userId}/role`, { json: { role } }).json();
}

export async function removeMember(householdId: string, userId: string): Promise<any> {
  return await api.delete(`api/v1/households/${householdId}/members/${userId}`).json();
}

/* Contact Categories API */
export async function fetchContactCategories(householdId: string): Promise<ContactCategory[]> {
  return await api.get(`api/v1/households/${householdId}/contact-categories`).json<ContactCategory[]>();
}

export async function createContactCategory(
  householdId: string,
  payload: { name: string; icon: string; color: string }
): Promise<ContactCategory> {
  return await api.post(`api/v1/households/${householdId}/contact-categories`, { json: payload }).json<ContactCategory>();
}

export async function updateContactCategory(
  householdId: string,
  catId: string,
  payload: { name: string; icon: string; color: string }
): Promise<ContactCategory> {
  return await api.put(`api/v1/households/${householdId}/contact-categories/${catId}`, { json: payload }).json<ContactCategory>();
}

export async function deleteContactCategory(householdId: string, catId: string): Promise<any> {
  return await api.delete(`api/v1/households/${householdId}/contact-categories/${catId}`).json();
}

/* Contacts API */
export async function fetchContacts(householdId: string): Promise<Contact[]> {
  return await api.get(`api/v1/households/${householdId}/contacts`).json<Contact[]>();
}

export async function createContact(
  householdId: string,
  payload: { category_id: string | null; name: string; phone: string; email: string; address: string; latitude: number | null; longitude: number | null; description: string; links: string[] }
): Promise<Contact> {
  return await api.post(`api/v1/households/${householdId}/contacts`, { json: payload }).json<Contact>();
}

export async function updateContact(
  householdId: string,
  contactId: string,
  payload: { category_id: string | null; name: string; phone: string; email: string; address: string; latitude: number | null; longitude: number | null; description: string; links: string[] }
): Promise<Contact> {
  return await api.put(`api/v1/households/${householdId}/contacts/${contactId}`, { json: payload }).json<Contact>();
}

export async function deleteContact(householdId: string, contactId: string): Promise<any> {
  return await api.delete(`api/v1/households/${householdId}/contacts/${contactId}`).json();
}
