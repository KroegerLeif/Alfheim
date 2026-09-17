'use client';

/**
 * Framework-agnostic OpenID Connect Authorization Code Flow with PKCE.
 *
 * This module contains no React and no identity-provider-specific code. It works
 * against any spec-compliant OIDC provider (Zitadel, Auth0, ...) by reading the
 * provider metadata from the discovery document (`{issuer}/.well-known/openid-configuration`).
 *
 * Shared by every Alfheim frontend. Tokens are stored under a single same-origin
 * sessionStorage key so a login performed in one app is honored by every other app
 * running behind the same reverse proxy (same origin, same PKCE client).
 */

import type { OidcConfig, OidcProviderMetadata, OidcTokenSet, OidcClaims } from './oidcTypes';
import { InsecureContextError, IssuerUnreachableError } from './oidcTypes';

export const VERIFIER_KEY = 'alfheim_oidc_pkce_verifier';
export const STATE_KEY = 'alfheim_oidc_state';
export const RETURN_TO_KEY = 'alfheim_oidc_return_to';
export const TOKEN_KEY = 'alfheim_oidc_tokens';
/** Legacy single-string access token key, kept for readers that have not migrated yet. */
export const LEGACY_ACCESS_TOKEN_KEY = 'alfheim_access_token';

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

/**
 * Returns an {@link InsecureContextError} when the page runs outside a browser Secure
 * Context, where `crypto.subtle` (required for the PKCE challenge) is unavailable.
 * Returns null on the server and wherever Web Crypto is usable.
 */
export function detectInsecureContext(): InsecureContextError | null {
  if (typeof window === 'undefined') return null;
  // Only an explicit `false` counts: DOMs that do not implement the flag (e.g. jsdom)
  // are judged solely by whether crypto.subtle actually exists.
  if (window.isSecureContext !== false && globalThis.crypto?.subtle) return null;
  const { host, pathname, search, hash } = window.location;
  return new InsecureContextError(host, `https://${host}${pathname}${search}${hash}`);
}

let metadataCache: Promise<OidcProviderMetadata> | null = null;

/**
 * Maps a network-level discovery failure (the fetch promise rejected, no HTTP response) to
 * {@link IssuerUnreachableError} when the issuer is HTTPS on another host than the page:
 * that is where an untrusted private-CA certificate silently breaks the request, because
 * browsers accept certificate exceptions per host and never show an interstitial for fetch.
 * Any other failure is returned unchanged.
 */
export function classifyDiscoveryNetworkError(issuer: string, discoveryUrl: string, err: unknown): unknown {
  if (!(err instanceof TypeError) || typeof window === 'undefined') return err;
  let issuerUrl: URL;
  try {
    issuerUrl = new URL(issuer);
  } catch {
    return err;
  }
  if (issuerUrl.protocol !== 'https:' || issuerUrl.host === window.location?.host) return err;
  return new IssuerUnreachableError(issuer.replace(/\/+$/, ''), discoveryUrl, issuerUrl.host, { cause: err });
}

export function discoverProviderMetadata(issuer: string): Promise<OidcProviderMetadata> {
  if (!metadataCache) {
    const discoveryUrl = `${issuer.replace(/\/+$/, '')}${DISCOVERY_SUFFIX}`;
    metadataCache = fetch(discoveryUrl, {
      headers: { Accept: 'application/json' },
    }).then(async (res) => {
      if (!res.ok) {
        metadataCache = null;
        throw new Error(`OIDC discovery failed with status ${res.status}`);
      }
      return (await res.json()) as OidcProviderMetadata;
    }, (err: unknown) => {
      throw classifyDiscoveryNetworkError(issuer, discoveryUrl, err);
    });
    metadataCache.catch(() => {
      metadataCache = null;
    });
  }
  return metadataCache;
}

/** Resets the module-level discovery cache. Exposed for tests only. */
export function resetDiscoveryCacheForTests(): void {
  metadataCache = null;
}

/** Decodes the payload of a JWT into typed OIDC claims without verifying the signature. */
export function decodeClaims(token: string): OidcClaims | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
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
    iss: payload.iss,
    exp: payload.exp,
  };
}

/** Decodes the raw payload of a JWT without verifying the signature. */
export function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/** Builds the authorize URL, persisting the PKCE verifier and state, then redirects the browser. */
export async function beginLogin(config: OidcConfig): Promise<void> {
  const insecure = detectInsecureContext();
  if (insecure) throw insecure;

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

export function persistTokens(tokens: OidcTokenSet): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    sessionStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, tokens.accessToken);
  } catch {
    /* storage disabled - tokens stay in memory only */
  }
}

export function loadPersistedTokens(): OidcTokenSet | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OidcTokenSet;
  } catch {
    return null;
  }
}

export function clearPersistedTokens(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
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

/** Detects an authorization-code redirect and, if valid, exchanges it for tokens. */
export async function completeLoginIfRedirected(config: OidcConfig): Promise<OidcTokenSet | null> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  if (!code) return null;

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);

  // Always scrub the callback params from the address bar.
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

/** Exchanges a refresh token for a fresh token set. Returns null when refresh is not possible. */
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

/** Clears local state and redirects to the provider end-session endpoint when available. */
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
