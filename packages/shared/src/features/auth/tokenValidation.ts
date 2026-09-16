import type { OidcTokenSet } from './oidcTypes';
import { decodeJwtPayload } from './oidcFlow';

/** Small clock-skew allowance applied to every expiry / not-yet-valid check. */
const DEFAULT_SKEW_MS = 5_000;

function normalizeIssuer(issuer: string): string {
  return issuer.trim().replace(/\/+$/, '');
}

/**
 * Validates a token set restored from storage before it is trusted.
 *
 * A session must never be accepted purely because it "has not expired yet" —
 * it must also have been issued by the currently configured OIDC issuer. This
 * prevents a stale session (e.g. from before Zitadel was reprovisioned, or from
 * a differently configured deployment sharing the same browser profile) from
 * being silently accepted.
 */
export function isTokenSetValid(
  tokens: OidcTokenSet | null | undefined,
  issuer: string,
  skewMs: number = DEFAULT_SKEW_MS,
): boolean {
  if (!tokens || !tokens.accessToken) return false;
  if (!issuer || issuer.trim() === '') return false;

  const expectedIssuer = normalizeIssuer(issuer);
  const now = Date.now();

  if (typeof tokens.expiresAt !== 'number' || tokens.expiresAt - skewMs <= now) {
    return false;
  }

  const accessClaims = decodeJwtPayload(tokens.accessToken);
  if (!accessClaims) return false;
  if (!isClaimsValid(accessClaims, expectedIssuer, now, skewMs)) return false;

  if (tokens.idToken) {
    const idClaims = decodeJwtPayload(tokens.idToken);
    // A present-but-malformed id token, or one that fails validation, is treated
    // as a corrupted session rather than being ignored.
    if (!idClaims || !isClaimsValid(idClaims, expectedIssuer, now, skewMs)) {
      return false;
    }
  }

  return true;
}

function isClaimsValid(
  claims: Record<string, any>,
  expectedIssuer: string,
  now: number,
  skewMs: number,
): boolean {
  if (typeof claims.iss !== 'string' || normalizeIssuer(claims.iss) !== expectedIssuer) {
    return false;
  }
  if (typeof claims.exp === 'number' && claims.exp * 1000 - skewMs <= now) {
    return false;
  }
  return true;
}
