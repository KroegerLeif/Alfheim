import { describe, it, expect } from 'vitest';
import { isTokenSetValid } from '../tokenValidation';
import type { OidcTokenSet } from '../oidcTypes';
import { makeJwt } from './testUtils';

const ISSUER = 'https://auth.alfheim.loegien.de';

function tokenSet(overrides: Partial<OidcTokenSet> & { accessClaims?: Record<string, unknown>; idClaims?: Record<string, unknown> | null } = {}): OidcTokenSet {
  const nowSec = Math.floor(Date.now() / 1000);
  const { accessClaims, idClaims, ...tokenOverrides } = overrides;
  const accessToken = makeJwt({ sub: 'user-1', iss: ISSUER, exp: nowSec + 300, ...accessClaims });
  const idToken = idClaims === null ? null : makeJwt({ sub: 'user-1', iss: ISSUER, exp: nowSec + 300, ...idClaims });
  return {
    accessToken,
    refreshToken: 'refresh-token',
    idToken,
    expiresAt: Date.now() + 300_000,
    ...tokenOverrides,
  };
}

describe('isTokenSetValid', () => {
  it('rejects a null token set', () => {
    expect(isTokenSetValid(null, ISSUER)).toBe(false);
  });

  it('rejects when the envelope expiresAt has passed', () => {
    const tokens = tokenSet({ expiresAt: Date.now() - 1000 });
    expect(isTokenSetValid(tokens, ISSUER)).toBe(false);
  });

  it('rejects when the access token exp claim has passed', () => {
    const tokens = tokenSet({ accessClaims: { exp: Math.floor(Date.now() / 1000) - 60 } });
    expect(isTokenSetValid(tokens, ISSUER)).toBe(false);
  });

  it('rejects when the access token issuer does not match the configured issuer', () => {
    const tokens = tokenSet({ accessClaims: { iss: 'https://old-issuer.example.com' } });
    expect(isTokenSetValid(tokens, ISSUER)).toBe(false);
  });

  it('rejects when the id token issuer does not match, even if the access token matches', () => {
    const tokens = tokenSet({ idClaims: { iss: 'https://old-issuer.example.com' } });
    expect(isTokenSetValid(tokens, ISSUER)).toBe(false);
  });

  it('rejects when no issuer is configured', () => {
    const tokens = tokenSet();
    expect(isTokenSetValid(tokens, '')).toBe(false);
  });

  it('accepts a fresh token set issued by the configured issuer', () => {
    const tokens = tokenSet();
    expect(isTokenSetValid(tokens, ISSUER)).toBe(true);
  });

  it('accepts when there is no id token', () => {
    const tokens = tokenSet({ idClaims: null });
    expect(isTokenSetValid(tokens, ISSUER)).toBe(true);
  });

  it('tolerates a trailing slash difference between the token issuer and configured issuer', () => {
    const tokens = tokenSet();
    expect(isTokenSetValid(tokens, `${ISSUER}/`)).toBe(true);
  });
});
