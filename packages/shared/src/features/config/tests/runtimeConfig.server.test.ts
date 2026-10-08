import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isLocalEnvironment, resolveApiUrl, resolveFrontendUrl } from '../runtimeConfig';

/** Server-side (no `window`) resolution paths used during SSR and in route handlers. */
describe('runtimeConfig on the server', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Simulate a server runtime: the shared setup file needs jsdom, so hide `window` instead.
    vi.stubGlobal('window', undefined);
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_FRONTEND_URL;
    delete process.env.ALFHEIM_BASE_URL;
    delete process.env.ENVIRONMENT;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = originalEnv;
  });

  it('derives local development from ENVIRONMENT / NODE_ENV', () => {
    process.env.ENVIRONMENT = 'dev';
    expect(isLocalEnvironment()).toBe(true);
    process.env.ENVIRONMENT = 'production';
    expect(isLocalEnvironment()).toBe(false);
  });

  it('resolves the frontend URL from NEXT_PUBLIC_FRONTEND_URL, then ALFHEIM_BASE_URL, then the default', () => {
    process.env.NEXT_PUBLIC_FRONTEND_URL = ' https://alfheim.example ';
    expect(resolveFrontendUrl()).toBe('https://alfheim.example');

    delete process.env.NEXT_PUBLIC_FRONTEND_URL;
    process.env.ALFHEIM_BASE_URL = 'https://base.example';
    expect(resolveFrontendUrl()).toBe('https://base.example');

    delete process.env.ALFHEIM_BASE_URL;
    expect(resolveFrontendUrl()).toBe('http://alfheim.loegien.localhost');
  });

  it('resolves API URLs from the explicit env var or against the base URL', () => {
    expect(resolveApiUrl('/api/v1/pantry', ' https://api.example/pantry ')).toBe('https://api.example/pantry');

    process.env.ALFHEIM_BASE_URL = 'https://base.example/';
    expect(resolveApiUrl('/api/v1/pantry')).toBe('https://base.example/api/v1/pantry');
    expect(resolveApiUrl('api/v1/chores')).toBe('https://base.example/api/v1/chores');

    delete process.env.ALFHEIM_BASE_URL;
    expect(resolveApiUrl('/api/v1/chat', '  ')).toBe('http://alfheim.loegien.localhost/api/v1/chat');
  });
});
