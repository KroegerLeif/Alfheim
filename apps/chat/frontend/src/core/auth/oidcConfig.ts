"use client";

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

export const VERIFIER_KEY = "alfheim_oidc_pkce_verifier";
export const STATE_KEY = "alfheim_oidc_state";
export const RETURN_TO_KEY = "alfheim_oidc_return_to";
export const TOKEN_KEY = "alfheim_oidc_tokens";

const DISCOVERY_SUFFIX = "/.well-known/openid-configuration";

export function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  view.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomString(byteLength = 32): string {
  const array = new Uint8Array(byteLength);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function sha256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

export function resolveOidcIssuer(): string {
  if (typeof window !== "undefined") {
    const runtime = (window as unknown as { __ALFHEIM_ENV__?: { OIDC_ISSUER?: string } }).__ALFHEIM_ENV__;
    if (runtime?.OIDC_ISSUER && runtime.OIDC_ISSUER.trim() !== "") {
      return runtime.OIDC_ISSUER.trim().replace(/\/+$/, "");
    }
  }
  const envIssuer = process.env.NEXT_PUBLIC_OIDC_ISSUER;
  if (envIssuer && envIssuer.trim() !== "") {
    return envIssuer.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
}

export function loadOidcConfig(): OidcConfig {
  const redirectUri =
    process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI ||
    (typeof window !== "undefined" ? `${window.location.origin}/chat/en` : "http://localhost:3000/chat/en");

  return {
    issuer: resolveOidcIssuer(),
    clientId: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "chat-frontend",
    redirectUri,
    scope: process.env.NEXT_PUBLIC_OIDC_SCOPE || "openid profile email offline_access",
  };
}

let metadataCache: Promise<OidcProviderMetadata> | null = null;

export function discoverProviderMetadata(issuer: string): Promise<OidcProviderMetadata> {
  if (!metadataCache) {
    metadataCache = fetch(`${issuer.replace(/\/+$/, "")}${DISCOVERY_SUFFIX}`, {
      headers: { Accept: "application/json" },
    }).then(async (res) => {
      if (!res.ok) {
        metadataCache = null;
        throw new Error(`OIDC discovery failed with status ${res.status}`);
      }
      return (await res.json()) as OidcProviderMetadata;
    });
  }
  return metadataCache;
}

export function decodeClaims(token: string): OidcClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    ) as Record<string, string>;
    return {
      sub: payload.sub || "",
      preferred_username: payload.preferred_username || payload.email || "user",
      email: payload.email || "",
      given_name: payload.given_name || "",
      family_name: payload.family_name || "",
      name:
        payload.name ||
        `${payload.given_name || ""} ${payload.family_name || ""}`.trim() ||
        payload.preferred_username ||
        "User",
    };
  } catch {
    return null;
  }
}

export function persistTokens(tokens: OidcTokenSet): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } catch {
    /* storage disabled */
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
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
}
