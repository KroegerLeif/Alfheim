"use client";

import {
  OidcConfig,
  OidcTokenSet,
  VERIFIER_KEY,
  STATE_KEY,
  RETURN_TO_KEY,
  randomString,
  sha256Challenge,
  discoverProviderMetadata,
  persistTokens,
  clearPersistedTokens,
} from "./oidcConfig";

export async function beginLogin(config: OidcConfig): Promise<void> {
  const metadata = await discoverProviderMetadata(config.issuer);

  const verifier = randomString(32);
  const state = randomString(16);
  const challenge = await sha256Challenge(verifier);

  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(RETURN_TO_KEY, window.location.pathname + window.location.search);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  window.location.assign(`${metadata.authorization_endpoint}?${params.toString()}`);
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
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  if (!code) return null;

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);

  ["code", "state", "session_state", "iss"].forEach((p) => url.searchParams.delete(p));
  const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
  window.history.replaceState({}, document.title, returnTo || url.pathname + url.search);
  sessionStorage.removeItem(RETURN_TO_KEY);

  if (!verifier || !expectedState || returnedState !== expectedState) {
    clearPersistedTokens();
    return null;
  }

  const metadata = await discoverProviderMetadata(config.issuer);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: verifier,
  });

  const res = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });

  const res = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
      if (idToken) params.set("id_token_hint", idToken);
      params.set("post_logout_redirect_uri", config.redirectUri);
      window.location.assign(`${metadata.end_session_endpoint}?${params.toString()}`);
      return;
    }
  } catch {
    /* fall through to local redirect */
  }
  window.location.assign(config.redirectUri);
}
