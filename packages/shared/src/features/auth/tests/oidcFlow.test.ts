import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  decodeClaims,
  decodeJwtPayload,
  discoverProviderMetadata,
  resetDiscoveryCacheForTests,
  persistTokens,
  loadPersistedTokens,
  clearPersistedTokens,
  TOKEN_KEY,
  LEGACY_ACCESS_TOKEN_KEY,
} from '../oidcFlow';
import { makeJwt } from './testUtils';
import type { OidcTokenSet } from '../oidcTypes';

describe('decodeClaims / decodeJwtPayload', () => {
  it('returns null for a malformed token', () => {
    expect(decodeClaims('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  it('decodes standard OIDC claims, deriving a display name when absent', () => {
    const token = makeJwt({ sub: 'u1', preferred_username: 'leif', email: 'leif@example.com', given_name: 'Leif', family_name: 'Kroeger' });
    const claims = decodeClaims(token);
    expect(claims).toEqual(
      expect.objectContaining({
        sub: 'u1',
        preferred_username: 'leif',
        email: 'leif@example.com',
        name: 'Leif Kroeger',
      }),
    );
  });

  it('falls back to preferred_username, then "User", when no name parts are present', () => {
    const token = makeJwt({ sub: 'u1', preferred_username: 'leif' });
    expect(decodeClaims(token)?.name).toBe('leif');

    const anon = makeJwt({ sub: 'u2' });
    expect(decodeClaims(anon)?.name).toBe('User');
  });
});

describe('discoverProviderMetadata', () => {
  beforeEach(() => {
    resetDiscoveryCacheForTests();
  });

  it('fetches and caches the discovery document', async () => {
    const metadata = { issuer: 'https://auth.example.com', authorization_endpoint: 'a', token_endpoint: 't', jwks_uri: 'j' };
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(metadata) } as Response));
    vi.stubGlobal('fetch', fetchMock);

    const first = await discoverProviderMetadata('https://auth.example.com/');
    const second = await discoverProviderMetadata('https://auth.example.com/');

    expect(first).toEqual(metadata);
    expect(second).toEqual(metadata);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.com/.well-known/openid-configuration',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
    vi.unstubAllGlobals();
  });

  it('throws and clears the cache when discovery responds with a non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 503 } as Response)));

    await expect(discoverProviderMetadata('https://auth.example.com')).rejects.toThrow(/503/);

    // Cache was cleared, so a subsequent success is possible without a stale rejection.
    const metadata = { issuer: 'https://auth.example.com', authorization_endpoint: 'a', token_endpoint: 't', jwks_uri: 'j' };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(metadata) } as Response)));
    await expect(discoverProviderMetadata('https://auth.example.com')).resolves.toEqual(metadata);
    vi.unstubAllGlobals();
  });
});

describe('token persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  const tokens: OidcTokenSet = {
    accessToken: 'access',
    refreshToken: 'refresh',
    idToken: 'id',
    expiresAt: Date.now() + 60_000,
  };

  it('persists both the structured token set and the legacy single-string key', () => {
    persistTokens(tokens);
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe(JSON.stringify(tokens));
    expect(sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)).toBe('access');
  });

  it('round-trips through loadPersistedTokens', () => {
    persistTokens(tokens);
    expect(loadPersistedTokens()).toEqual(tokens);
  });

  it('returns null when nothing is persisted or the payload is corrupt', () => {
    expect(loadPersistedTokens()).toBeNull();
    sessionStorage.setItem(TOKEN_KEY, '{not-json');
    expect(loadPersistedTokens()).toBeNull();
  });

  it('clears every auth-related session key', () => {
    persistTokens(tokens);
    sessionStorage.setItem('alfheim_oidc_pkce_verifier', 'v');
    sessionStorage.setItem('alfheim_oidc_state', 's');
    clearPersistedTokens();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem('alfheim_oidc_pkce_verifier')).toBeNull();
    expect(sessionStorage.getItem('alfheim_oidc_state')).toBeNull();
  });
});
