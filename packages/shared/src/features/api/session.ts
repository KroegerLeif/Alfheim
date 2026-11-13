import { LEGACY_ACCESS_TOKEN_KEY } from '../auth/oidcFlow';
import { applyHouseholdHeaders, reportHouseholdErrorResponse } from '../household/householdStore';
import type { ApiSession } from './types';

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  } catch (error) {
    // Storage can be blocked (sandboxed frame, privacy mode); the request then goes out unauthenticated.
    console.warn('Cannot read the access token from sessionStorage:', error);
    return null;
  }
}

async function refreshFromBridge(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const bridge = window.__alfheim_oidc__;
  if (!bridge || typeof bridge.refresh !== 'function') return null;
  return bridge.refresh();
}

/**
 * The browser session every Alfheim frontend shares: the access token from the OIDC token
 * store in `sessionStorage`, refresh and login through the `window.__alfheim_oidc__` bridge,
 * the active household as `X-Household-ID` (never `X-Household-Role`) and household error
 * reporting to the mounted `HouseholdProvider`.
 */
export function createBrowserApiSession(): ApiSession {
  return {
    getToken: readStoredToken,
    refreshToken: refreshFromBridge,
    onAuthFailure: () => {
      if (typeof window === 'undefined') return;
      window.__alfheim_oidc__?.login();
    },
    prepareHeaders: (headers) => {
      if (typeof window !== 'undefined') applyHouseholdHeaders(headers);
    },
    onErrorResponse: (response) => reportHouseholdErrorResponse(response),
  };
}
