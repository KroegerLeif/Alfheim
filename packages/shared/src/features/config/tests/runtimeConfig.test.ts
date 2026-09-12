import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isLocalEnvironment,
  resolveFrontendUrl,
  resolveApiUrl,
  AlfheimRuntimeWindow,
} from '../runtimeConfig';

describe('runtimeConfig', () => {
  const originalEnv = process.env;
  const originalLocation = window.location;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete (window as unknown as AlfheimRuntimeWindow).__ALFHEIM_ENV__;
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  function setWindowLocation(href: string) {
    const url = new URL(href);
    Object.defineProperty(window, 'location', {
      value: {
        href: url.href,
        origin: url.origin,
        protocol: url.protocol,
        host: url.host,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
      },
      writable: true,
    });
  }

  describe('isLocalEnvironment', () => {
    it('detects localhost and .localhost in browser', () => {
      setWindowLocation('http://localhost:3000');
      expect(isLocalEnvironment()).toBe(true);

      setWindowLocation('http://alfheim.loegien.localhost/pantry');
      expect(isLocalEnvironment()).toBe(true);

      setWindowLocation('http://127.0.0.1:8080');
      expect(isLocalEnvironment()).toBe(true);

      setWindowLocation('http://homelab.local');
      expect(isLocalEnvironment()).toBe(true);
    });

    it('detects production domains in browser', () => {
      setWindowLocation('https://alfheim.loegien.de/pantry');
      expect(isLocalEnvironment()).toBe(false);

      setWindowLocation('https://myos.org');
      expect(isLocalEnvironment()).toBe(false);
    });
  });

  describe('resolveFrontendUrl', () => {
    it('prefers window.__ALFHEIM_ENV__.FRONTEND_URL when present', () => {
      setWindowLocation('https://alfheim.loegien.de/pantry');
      (window as unknown as AlfheimRuntimeWindow).__ALFHEIM_ENV__ = {
        FRONTEND_URL: 'https://alfheim.loegien.de',
      };
      expect(resolveFrontendUrl()).toBe('https://alfheim.loegien.de');
    });

    it('overrides baked-in localhost in production browser', () => {
      setWindowLocation('https://alfheim.loegien.de/pantry');
      process.env.NEXT_PUBLIC_FRONTEND_URL = 'http://alfheim.loegien.localhost';

      expect(resolveFrontendUrl()).toBe('https://alfheim.loegien.de');
    });

    it('falls back to window.location.origin in browser', () => {
      setWindowLocation('https://alfheim.loegien.de/shopping');
      delete process.env.NEXT_PUBLIC_FRONTEND_URL;

      expect(resolveFrontendUrl()).toBe('https://alfheim.loegien.de');
    });
  });

  describe('resolveApiUrl', () => {
    it('prefers window.__ALFHEIM_ENV__.API_URL when present', () => {
      setWindowLocation('https://alfheim.loegien.de');
      (window as unknown as AlfheimRuntimeWindow).__ALFHEIM_ENV__ = {
        API_URL: 'https://api.alfheim.loegien.de/v1',
      };
      expect(resolveApiUrl('/api/v1/pantry')).toBe('https://api.alfheim.loegien.de/v1');
    });

    it('resolves relative path with window.location.origin in browser', () => {
      setWindowLocation('https://alfheim.loegien.de/pantry');
      expect(resolveApiUrl('/pantry/api/v1')).toBe('https://alfheim.loegien.de/pantry/api/v1');
    });

    it('overrides baked-in localhost API url in production browser', () => {
      setWindowLocation('https://alfheim.loegien.de/pantry');
      const envUrl = 'http://api.alfheim.loegien.localhost/pantry/api/v1';

      expect(resolveApiUrl('/pantry/api/v1', envUrl)).toBe('https://alfheim.loegien.de/pantry/api/v1');
    });

    it('preserves custom production API URL in production browser', () => {
      setWindowLocation('https://alfheim.loegien.de/pantry');
      const customUrl = 'https://api.alfheim.loegien.de/pantry/api/v1';

      expect(resolveApiUrl('/pantry/api/v1', customUrl)).toBe('https://api.alfheim.loegien.de/pantry/api/v1');
    });
  });
});
