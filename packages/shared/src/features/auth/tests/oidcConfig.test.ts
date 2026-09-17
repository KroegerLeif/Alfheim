import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadOidcConfig } from '../oidcConfig';
import { OidcConfigError } from '../oidcTypes';

describe('loadOidcConfig', () => {
  const originalEnv = process.env;
  const originalLocation = window.location;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete (window as any).__ALFHEIM_ENV__;
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  function setWindowLocation(href: string) {
    const url = new URL(href);
    Object.defineProperty(window, 'location', {
      value: { href: url.href, origin: url.origin, pathname: url.pathname },
      writable: true,
    });
  }

  it('throws OidcConfigError when the issuer is empty', () => {
    setWindowLocation('https://alfheim.loegien.de/pantry');
    delete process.env.NEXT_PUBLIC_OIDC_ISSUER;
    delete process.env.NEXT_PUBLIC_OIDC_CLIENT_ID;

    expect(() => loadOidcConfig('/pantry')).toThrow(OidcConfigError);
    expect(() => loadOidcConfig('/pantry')).toThrow(/issuer/i);
  });

  it('throws OidcConfigError when the client id is empty', () => {
    setWindowLocation('https://alfheim.loegien.de/pantry');
    (window as any).__ALFHEIM_ENV__ = { OIDC_ISSUER: 'https://auth.alfheim.loegien.de' };

    expect(() => loadOidcConfig('/pantry')).toThrow(OidcConfigError);
    expect(() => loadOidcConfig('/pantry')).toThrow(/client id/i);
  });

  it('never falls back to window.location.origin for the issuer', () => {
    setWindowLocation('https://alfheim.loegien.de/pantry');
    expect(() => loadOidcConfig('/pantry')).toThrow(OidcConfigError);
  });

  it('builds a valid config from runtime env, scoping the redirect URI to basePath', () => {
    setWindowLocation('https://alfheim.loegien.de/pantry/en');
    (window as any).__ALFHEIM_ENV__ = {
      OIDC_ISSUER: 'https://auth.alfheim.loegien.de/',
      OIDC_CLIENT_ID: 'alfheim-frontend',
    };

    const config = loadOidcConfig('/pantry');

    expect(config.issuer).toBe('https://auth.alfheim.loegien.de');
    expect(config.clientId).toBe('alfheim-frontend');
    expect(config.redirectUri).toBe('https://alfheim.loegien.de/pantry/');
    expect(config.scope).toContain('openid');
  });

  it('normalizes a basePath given without a leading slash', () => {
    setWindowLocation('https://alfheim.loegien.de/');
    (window as any).__ALFHEIM_ENV__ = {
      OIDC_ISSUER: 'https://auth.alfheim.loegien.de',
      OIDC_CLIENT_ID: 'dashboard-frontend',
    };

    const config = loadOidcConfig('');
    expect(config.redirectUri).toBe('https://alfheim.loegien.de/');
  });

  it('falls back to NEXT_PUBLIC_* build-time variables in dev when runtime env is absent', () => {
    setWindowLocation('http://localhost:3000');
    process.env.NEXT_PUBLIC_OIDC_ISSUER = 'http://localhost:8080';
    process.env.NEXT_PUBLIC_OIDC_CLIENT_ID = 'dashboard-frontend';

    const config = loadOidcConfig('');
    expect(config.issuer).toBe('http://localhost:8080');
    expect(config.clientId).toBe('dashboard-frontend');
  });
});
