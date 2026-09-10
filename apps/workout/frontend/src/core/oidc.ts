'use client';

/**
 * Framework-agnostic OpenID Connect Authorization Code Flow with PKCE.
 *
 * Generic spec-compliant OIDC provider implementation (Zitadel, Keycloak, etc.)
 * reading metadata from `{issuer}/.well-known/openid-configuration`.
 */

export interface OidcConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

export interface OidcProviderMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
  userinfo_endpoint?: string;
}

export interface OidcTokenSet {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  /** Absolute expiry timestamp in milliseconds since the epoch. */
  expiresAt: number;
}

export interface OidcClaims {
  sub: string;
  preferred_username: string;
  email: string;
  given_name?: string;
  family_name?: string;
  name?: string;
}

const VERIFIER_KEY = 'workout_oidc_pkce_verifier';
const STATE_KEY = 'workout_oidc_state';
const RETURN_TO_KEY = 'workout_oidc_return_to';
const TOKEN_KEY = 'token_workout-frontend';
const SHARED_TOKEN_KEY = 'alfheim_access_token';

const DISCOVERY_SUFFIX = '/.well-known/openid-configuration';

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  view.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLength = 32): string {
  const array = new Uint8Array(byteLength);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function sha256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

export function resolveOidcIssuer(): string {
  if (typeof window !== 'undefined') {
    const runtime = (window as unknown as { __ALFHEIM_ENV__?: { OIDC_ISSUER?: string } }).__ALFHEIM_ENV__;
    if (runtime?.OIDC_ISSUER && runtime.OIDC_ISSUER.trim() !== '') {
      return runtime.OIDC_ISSUER.trim().replace(/\/+$/, '');
    }
  }
  const envIssuer = process.env.NEXT_PUBLIC_OIDC_ISSUER || process.env.NEXT_PUBLIC_KEYCLOAK_URL;
  if (envIssuer && envIssuer.trim() !== '') {
    return envIssuer.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:8080';
}

export function loadOidcConfig(): OidcConfig {
  const redirectUri =
    process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI ||
    (typeof window !== 'undefined' ? `${window.location.origin}/workout/de` : 'http://localhost:3000/workout/de');

  return {
    issuer: resolveOidcIssuer(),
    clientId: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || 'workout-frontend',
    redirectUri,
    scope: process.env.NEXT_PUBLIC_OIDC_SCOPE || 'openid profile email offline_access',
  };
}

let metadataCache: Promise<OidcProviderMetadata> | null = null;

export function discoverProviderMetadata(issuer: string): Promise<OidcProviderMetadata> {
  if (!metadataCache) {
    metadataCache = fetch(`${issuer.replace(/\/+$/, '')}${DISCOVERY_SUFFIX}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) {
          metadataCache = null;
          throw new Error(`OIDC discovery failed with status ${res.status}`);
        }
        return (await res.json()) as OidcProviderMetadata;
      })
      .catch((err) => {
        metadataCache = null;
        throw err;
      });
  }
  return metadataCache;
}

export function decodeClaims(token: string): OidcClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as Record<string, string>;
    return {
      sub: payload.sub || '',
      preferred_username: payload.preferred_username || payload.email || 'user',
      email: payload.email || '',
      given_name: payload.given_name || '',
      family_name: payload.family_name || '',
      name:
        payload.name ||
        `${payload.given_name || ''} ${payload.family_name || ''}`.trim() ||
        payload.preferred_username ||
        'User',
    };
  } catch {
    return null;
  }
}

export async function beginLogin(config: OidcConfig): Promise<void> {
  const metadata = await discoverProviderMetadata(config.issuer);

  const verifier = randomString(32);
  const state = randomString(16);
  const challenge = await sha256Challenge(verifier);

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_TO_KEY, window.location.pathname + window.location.search);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.assign(`${metadata.authorization_endpoint}?${params.toString()}`);
}

function persistTokens(tokens: OidcTokenSet): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, tokens.accessToken);
    sessionStorage.setItem(SHARED_TOKEN_KEY, tokens.accessToken);
    sessionStorage.setItem('workout_oidc_tokens', JSON.stringify(tokens));
  } catch {
    /* storage disabled */
  }
}

export function loadPersistedTokens(): OidcTokenSet | null {
  try {
    const raw = sessionStorage.getItem('workout_oidc_tokens');
    if (raw) return JSON.parse(raw) as OidcTokenSet;
    const fallbackToken = sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(SHARED_TOKEN_KEY);
    if (fallbackToken) {
      return {
        accessToken: fallbackToken,
        refreshToken: null,
        idToken: null,
        expiresAt: Date.now() + 300000,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPersistedTokens(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SHARED_TOKEN_KEY);
    sessionStorage.removeItem('workout_oidc_tokens');
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
}

interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
}

function toTokenSet(raw: RawTokenResponse): OidcTokenSet {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    idToken: raw.id_token ?? null,
    expiresAt: Date.now() + (raw.expires_in ?? 300) * 1000,
  };
}

export async function completeLoginIfRedirected(config: OidcConfig): Promise<OidcTokenSet | null> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  if (!code) return null;

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);

  ['code', 'state', 'session_state', 'iss'].forEach((p) => url.searchParams.delete(p));
  const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
  window.history.replaceState({}, document.title, returnTo || url.pathname + url.search);
  sessionStorage.removeItem(RETURN_TO_KEY);

  if (!verifier || !expectedState || returnedState !== expectedState) {
    clearPersistedTokens();
    return null;
  }

  const metadata = await discoverProviderMetadata(config.issuer);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: verifier,
  });

  const res = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (!res.ok) {
    throw new Error(`OIDC token exchange failed with status ${res.status}`);
  }

  const tokens = toTokenSet((await res.json()) as RawTokenResponse);
  persistTokens(tokens);
  return tokens;
}

export async function refreshTokens(
  config: OidcConfig,
  refreshToken: string | null,
): Promise<OidcTokenSet | null> {
  if (!refreshToken) return null;

  const metadata = await discoverProviderMetadata(config.issuer);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId,
  });

  const res = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) return null;

  const tokens = toTokenSet((await res.json()) as RawTokenResponse);
  persistTokens(tokens);
  return tokens;
}

export async function endSession(config: OidcConfig, idToken: string | null): Promise<void> {
  clearPersistedTokens();
  try {
    const metadata = await discoverProviderMetadata(config.issuer);
    if (metadata.end_session_endpoint) {
      const params = new URLSearchParams({ client_id: config.clientId });
      if (idToken) params.set('id_token_hint', idToken);
      params.set('post_logout_redirect_uri', config.redirectUri);
      window.location.assign(`${metadata.end_session_endpoint}?${params.toString()}`);
      return;
    }
  } catch {
    /* fall through to local redirect */
  }
  window.location.assign(config.redirectUri);
}
