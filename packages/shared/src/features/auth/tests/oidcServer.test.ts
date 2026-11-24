import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadOidcConfig } from '../oidcConfig';
import { classifyDiscoveryNetworkError, decodeClaims, detectInsecureContext } from '../oidcFlow';
import { OidcConfigError } from '../oidcTypes';
import { makeJwt } from './testUtils';

/**
 * Server-side branches: without `window` the config falls back to process env
 * for the issuer and the redirect origin, and the browser-only checks are no-ops.
 * The shared test setup needs jsdom, so `window` is stubbed away per test.
 */
describe('OIDC helpers without a window', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubGlobal('window', undefined);
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_OIDC_ISSUER: 'https://auth.example/',
      NEXT_PUBLIC_OIDC_CLIENT_ID: 'client',
    };
    delete process.env.ALFHEIM_BASE_URL;
    delete process.env.NEXT_PUBLIC_FRONTEND_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  it('runs without a window', () => {
    expect(typeof window).toBe('undefined');
  });

  it('builds the redirect URI from ALFHEIM_BASE_URL', () => {
    process.env.ALFHEIM_BASE_URL = ' https://app.example ';
    const config = loadOidcConfig('/pantry');
    expect(config.issuer).toBe('https://auth.example');
    expect(config.redirectUri).toBe('https://app.example/pantry/');
  });

  it('falls back to NEXT_PUBLIC_FRONTEND_URL', () => {
    process.env.NEXT_PUBLIC_FRONTEND_URL = 'https://front.example';
    expect(loadOidcConfig().redirectUri).toBe('https://front.example/');
  });

  it('uses a relative redirect URI when no origin is configured', () => {
    expect(loadOidcConfig('/chores').redirectUri).toBe('/chores/');
  });

  it('drops a base path made only of slashes', () => {
    process.env.ALFHEIM_BASE_URL = 'https://app.example';
    expect(loadOidcConfig('//').redirectUri).toBe('https://app.example/');
  });

  it('treats a missing process.env as an unconfigured issuer', () => {
    const saved = process.env;
    Reflect.set(process, 'env', undefined);
    try {
      expect(() => loadOidcConfig()).toThrow(OidcConfigError);
    } finally {
      process.env = saved;
    }
  });

  it('reports no insecure context on the server', () => {
    expect(detectInsecureContext()).toBeNull();
  });

  it('returns network errors unchanged on the server', () => {
    const err = new TypeError('Failed to fetch');
    expect(classifyDiscoveryNetworkError('https://auth.example', 'https://auth.example/d', err)).toBe(err);
  });

  it('decodes claims without a subject to an empty sub', () => {
    expect(decodeClaims(makeJwt({ email: 'a@example.com' }))?.sub).toBe('');
  });
});
