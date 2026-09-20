import { getHouseholdErrorCode, isHousehold, type Household, type HouseholdErrorCode } from './householdStore';

export const MY_HOUSEHOLDS_URL = '/api/v1/households/me';

export interface OidcWindow extends Window {
  __alfheim_oidc_instance__?: {
    token?: string;
    authenticated?: boolean;
    updateToken?: (minValidity?: number) => Promise<boolean>;
    login?: (options?: unknown) => Promise<void> | void;
  };
}

function getOidcInstance() {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as OidcWindow).__alfheim_oidc_instance__;
}

function resolveSessionToken(): string | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  const sharedToken = sessionStorage.getItem('alfheim_access_token');
  if (sharedToken) return sharedToken;

  try {
    const len = sessionStorage.length ?? 0;
    for (let i = 0; i < len; i++) {
      const key = typeof sessionStorage.key === 'function' ? sessionStorage.key(i) : Object.keys(sessionStorage)[i];
      if (key && key.startsWith('token_')) {
        const val = sessionStorage.getItem(key);
        if (val) return val;
      }
    }
  } catch {
    // Ignore cross-origin / storage errors
  }
  return null;
}

async function getFreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const oidc = getOidcInstance();
  if (oidc && typeof oidc.updateToken === 'function') {
    try {
      await oidc.updateToken(30);
      if (typeof oidc.token === 'string') {
        sessionStorage.setItem('alfheim_access_token', oidc.token);
        return oidc.token;
      }
    } catch {
      // Token update failed, fall back to storage resolution
    }
  }
  return (typeof oidc?.token === 'string' ? oidc.token : null) || resolveSessionToken();
}

export type FetchHouseholdsResult =
  | { ok: true; households: Household[] }
  | { ok: false; reason: 'no_token' | 'http' | 'network'; status?: number; code?: HouseholdErrorCode | null };

/**
 * Loads the caller's memberships from core/household
 * (`GET /api/v1/households/me`, each entry with `role` and `is_default`).
 * Retries once with a force-refreshed OIDC token on 401.
 */
export async function fetchMyHouseholds(url: string = MY_HOUSEHOLDS_URL): Promise<FetchHouseholdsResult> {
  try {
    const token = await getFreshToken();
    if (!token) return { ok: false, reason: 'no_token' };

    let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (res.status === 401) {
      const oidc = getOidcInstance();
      if (oidc && typeof oidc.updateToken === 'function') {
        try {
          const refreshed = await oidc.updateToken(-1);
          if (refreshed && typeof oidc.token === 'string') {
            const freshToken: string = oidc.token;
            sessionStorage.setItem('alfheim_access_token', freshToken);
            res = await fetch(url, { headers: { Authorization: `Bearer ${freshToken}` } });
          }
        } catch {
          // Retry refresh failed
        }
      }
    }

    if (!res.ok) {
      let code: HouseholdErrorCode | null = null;
      try {
        code = getHouseholdErrorCode(await res.json());
      } catch {
        // Non-JSON error body
      }
      return { ok: false, reason: 'http', status: res.status, code };
    }

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return { ok: false, reason: 'http', status: res.status };
    return { ok: true, households: data.filter(isHousehold) };
  } catch (err) {
    console.warn(`Failed to fetch households from ${url}:`, err);
    return { ok: false, reason: 'network' };
  }
}
