/**
 * Framework-agnostic types for the OpenID Connect Authorization Code Flow with PKCE.
 * Shared by every Alfheim frontend so there is exactly one definition of "a token set"
 * and "a validated session" across the platform.
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
  iss?: string;
  exp?: number;
}

/** Thrown by {@link loadOidcConfig} when the runtime configuration is missing or empty. */
export class OidcConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OidcConfigError';
  }
}

/**
 * Thrown when sign-in is attempted outside a browser Secure Context (plain HTTP on a
 * non-localhost host). Browsers withhold `crypto.subtle` there, which PKCE requires.
 * {@link InsecureContextError.httpsUrl} is the same page over HTTPS.
 */
export class InsecureContextError extends Error {
  readonly host: string;
  readonly httpsUrl: string;

  constructor(host: string, httpsUrl: string) {
    super(
      `Sign-in requires HTTPS. This page was opened over plain HTTP on ${host}, where the browser ` +
        `disables the Web Crypto API needed for secure login. Open ${httpsUrl} instead.`,
    );
    this.name = 'InsecureContextError';
    this.host = host;
    this.httpsUrl = httpsUrl;
  }
}
