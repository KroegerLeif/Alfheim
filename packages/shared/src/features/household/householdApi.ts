import { createApiClient, type ApiClient } from '../api/client';
import { getHouseholdErrorCode, isHousehold, type Household, type HouseholdErrorCode } from './householdStore';

export const MY_HOUSEHOLDS_URL = '/api/v1/households/me';

/**
 * Client for the membership API. It authenticates explicitly (see `getFreshToken`), so it uses
 * no session, but it inherits the shared default timeout: a hung membership call ends in the
 * `network` result that `HouseholdGate` turns into its retry view.
 */
const defaultHouseholdClient = createApiClient();

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
  } catch (error) {
    // Blocked storage: the caller continues without a token.
    console.warn('Cannot read the access token from sessionStorage:', error);
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
    } catch (error) {
      // Fall back to the stored token; the request then decides with a 401.
      console.warn('OIDC token update failed; using the stored token:', error);
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
 * Retries once with a force-refreshed OIDC token on 401. `client` is injectable for tests.
 */
export async function fetchMyHouseholds(
  url: string = MY_HOUSEHOLDS_URL,
  client: ApiClient = defaultHouseholdClient,
): Promise<FetchHouseholdsResult> {
  try {
    const token = await getFreshToken();
    if (!token) return { ok: false, reason: 'no_token' };

    let res = await client.get(url, { headers: { Authorization: `Bearer ${token}` } });

    if (res.status === 401) {
      const oidc = getOidcInstance();
      if (oidc && typeof oidc.updateToken === 'function') {
        try {
          const refreshed = await oidc.updateToken(-1);
          if (refreshed && typeof oidc.token === 'string') {
            const freshToken: string = oidc.token;
            sessionStorage.setItem('alfheim_access_token', freshToken);
            res = await client.get(url, { headers: { Authorization: `Bearer ${freshToken}` } });
          }
        } catch (error) {
          // The 401 response is reported below as the http result.
          console.warn('OIDC token refresh after a 401 failed:', error);
        }
      }
    }

    if (!res.ok) {
      let code: HouseholdErrorCode | null = null;
      try {
        code = getHouseholdErrorCode(await res.json());
      } catch (error) {
        // A non-JSON error body (for example a gateway page) carries no household error code.
        console.warn(`Household API answered HTTP ${res.status} without a JSON body:`, error);
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
