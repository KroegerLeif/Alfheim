import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  completeLoginIfRedirected,
  endSession,
  refreshTokens,
  resetDiscoveryCacheForTests,
  RETURN_TO_KEY,
  STATE_KEY,
  TOKEN_KEY,
  VERIFIER_KEY,
} from '../oidcFlow';
import type { OidcConfig } from '../oidcTypes';

const ISSUER = 'https://auth.example';
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
const TOKEN_ENDPOINT = `${ISSUER}/oauth/v2/token`;
const CONFIG: OidcConfig = { issuer: ISSUER, clientId: 'client-1', redirectUri: 'https://app.example/pantry/', scope: 'openid' };

const originalLocation = window.location;

function setLocation(href: string) {
  const url = new URL(href);
  Object.defineProperty(window, 'location', {
    value: { href: url.href, origin: url.origin, host: url.host, pathname: url.pathname, search: url.search, hash: url.hash, assign: vi.fn() },
    writable: true,
    configurable: true,
  });
}

/** Routes discovery and token requests to the given responses. */
function stubFetch({
  endSessionEndpoint,
  discoveryOk = true,
  token,
}: {
  endSessionEndpoint?: string;
  discoveryOk?: boolean;
  token?: { ok: boolean; status?: number; body?: Record<string, unknown> };
}) {
  const fetchMock = vi.fn((url: string) => {
    if (url === DISCOVERY_URL) {
      const metadata = { issuer: ISSUER, authorization_endpoint: 'a', token_endpoint: TOKEN_ENDPOINT, jwks_uri: 'j', end_session_endpoint: endSessionEndpoint };
      return Promise.resolve({ ok: discoveryOk, status: discoveryOk ? 200 : 503, json: () => Promise.resolve(metadata) } as Response);
    }
    return Promise.resolve({ ok: token?.ok ?? true, status: token?.status ?? 200, json: () => Promise.resolve(token?.body ?? {}) } as Response);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function tokenRequestBody(fetchMock: ReturnType<typeof stubFetch>): URLSearchParams {
  const call = fetchMock.mock.calls.find(([url]) => url === TOKEN_ENDPOINT) as unknown as [string, RequestInit];
  return call[1].body as URLSearchParams;
}

beforeEach(() => {
  resetDiscoveryCacheForTests();
  sessionStorage.clear();
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
});

describe('completeLoginIfRedirected', () => {
  it('returns null without an authorization code', async () => {
    setLocation('https://app.example/pantry/');
    expect(await completeLoginIfRedirected(CONFIG)).toBeNull();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it.each([
    ['the state differs', 'other', 'verifier'],
    ['no verifier is stored', 'state-1', null],
  ])('scrubs the callback and refuses the exchange when %s', async (_label, returnedState, verifier) => {
    setLocation(`https://app.example/pantry/?code=c1&state=${returnedState}&keep=1`);
    sessionStorage.setItem(STATE_KEY, 'state-1');
    if (verifier) sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(TOKEN_KEY, '{}');
    const fetchMock = stubFetch({});

    expect(await completeLoginIfRedirected(CONFIG)).toBeNull();
    expect(window.history.replaceState).toHaveBeenCalledWith({}, document.title, '/pantry/?keep=1');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('exchanges a valid code, persists the tokens and returns to the stored page', async () => {
    setLocation('https://app.example/pantry/?code=c1&state=state-1&session_state=s&iss=x');
    sessionStorage.setItem(STATE_KEY, 'state-1');
    sessionStorage.setItem(VERIFIER_KEY, 'verifier-1');
    sessionStorage.setItem(RETURN_TO_KEY, '/pantry/items?id=7');
    const fetchMock = stubFetch({ token: { ok: true, body: { access_token: 'at', refresh_token: 'rt', id_token: 'it', expires_in: 60 } } });

    const tokens = await completeLoginIfRedirected(CONFIG);

    expect(tokens).toMatchObject({ accessToken: 'at', refreshToken: 'rt', idToken: 'it' });
    expect(tokens!.expiresAt).toBeGreaterThan(Date.now() + 50_000);
    expect(Object.fromEntries(tokenRequestBody(fetchMock))).toEqual({
      grant_type: 'authorization_code',
      code: 'c1',
      redirect_uri: CONFIG.redirectUri,
      client_id: 'client-1',
      code_verifier: 'verifier-1',
    });
    expect(window.history.replaceState).toHaveBeenCalledWith({}, document.title, '/pantry/items?id=7');
    expect(sessionStorage.getItem(VERIFIER_KEY)).toBeNull();
    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
    expect(sessionStorage.getItem(RETURN_TO_KEY)).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(TOKEN_KEY)!).accessToken).toBe('at');
  });

  it('throws when the token endpoint rejects the code', async () => {
    setLocation('https://app.example/pantry/?code=c1&state=state-1');
    sessionStorage.setItem(STATE_KEY, 'state-1');
    sessionStorage.setItem(VERIFIER_KEY, 'verifier-1');
    stubFetch({ token: { ok: false, status: 400 } });

    await expect(completeLoginIfRedirected(CONFIG)).rejects.toThrow('OIDC token exchange failed with status 400');
    expect(sessionStorage.getItem(VERIFIER_KEY)).toBeNull();
  });
});

describe('refreshTokens', () => {
  it('returns null without a refresh token and does not call the provider', async () => {
    const fetchMock = stubFetch({});
    expect(await refreshTokens(CONFIG, null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when the provider refuses the refresh', async () => {
    stubFetch({ token: { ok: false, status: 400 } });
    expect(await refreshTokens(CONFIG, 'rt')).toBeNull();
  });

  it('defaults missing optional fields of the token response', async () => {
    const fetchMock = stubFetch({ token: { ok: true, body: { access_token: 'at2' } } });
    const tokens = await refreshTokens(CONFIG, 'rt');
    expect(tokens).toMatchObject({ accessToken: 'at2', refreshToken: null, idToken: null });
    expect(tokens!.expiresAt).toBeGreaterThan(Date.now() + 290_000);
    expect(Object.fromEntries(tokenRequestBody(fetchMock))).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'rt',
      client_id: 'client-1',
    });
  });
});

describe('endSession', () => {
  beforeEach(() => {
    setLocation('https://app.example/pantry/');
    sessionStorage.setItem(TOKEN_KEY, '{}');
  });

  it('redirects to the end-session endpoint with an id token hint', async () => {
    stubFetch({ endSessionEndpoint: `${ISSUER}/oidc/v1/end_session` });
    await endSession(CONFIG, 'id-1');
    const target = new URL((window.location.assign as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(target.origin + target.pathname).toBe(`${ISSUER}/oidc/v1/end_session`);
    expect(Object.fromEntries(target.searchParams)).toEqual({
      client_id: 'client-1',
      id_token_hint: 'id-1',
      post_logout_redirect_uri: CONFIG.redirectUri,
    });
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('omits the id token hint when there is no id token', async () => {
    stubFetch({ endSessionEndpoint: `${ISSUER}/end` });
    await endSession(CONFIG, null);
    const target = new URL((window.location.assign as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    expect(target.searchParams.has('id_token_hint')).toBe(false);
  });

  it.each([
    ['the provider has no end-session endpoint', true],
    ['discovery fails', false],
  ])('falls back to the app when %s', async (_label, discoveryOk) => {
    stubFetch({ discoveryOk });
    await endSession(CONFIG, 'id-1');
    expect(window.location.assign).toHaveBeenCalledWith(CONFIG.redirectUri);
  });
});
