import { describe, it, expect } from 'vitest';
import { buildRuntimeEnvPayload, buildRuntimeConfigScript, runtimeConfigGet } from '../runtimeConfigHandler';

describe('buildRuntimeEnvPayload', () => {
  it('reads OIDC_ISSUER_URL / OIDC_CLIENT_ID / ALFHEIM_BASE_URL from the container environment', () => {
    const payload = buildRuntimeEnvPayload({
      OIDC_ISSUER_URL: 'http://auth.alfheim.loegien.de',
      OIDC_CLIENT_ID: 'alfheim-frontend',
      ALFHEIM_BASE_URL: 'http://alfheim.loegien.de',
      NEXT_PUBLIC_API_URL: 'http://alfheim.loegien.de/api',
    });

    expect(payload).toEqual({
      OIDC_ISSUER: 'http://auth.alfheim.loegien.de',
      OIDC_CLIENT_ID: 'alfheim-frontend',
      FRONTEND_URL: 'http://alfheim.loegien.de',
      API_URL: 'http://alfheim.loegien.de/api',
    });
  });

  it('falls back to NEXT_PUBLIC_* variables when the primary ones are absent', () => {
    const payload = buildRuntimeEnvPayload({
      NEXT_PUBLIC_OIDC_ISSUER: 'http://localhost:8080',
      NEXT_PUBLIC_OIDC_CLIENT_ID: 'dev-client',
      NEXT_PUBLIC_FRONTEND_URL: 'http://localhost:3000',
    });

    expect(payload.OIDC_ISSUER).toBe('http://localhost:8080');
    expect(payload.OIDC_CLIENT_ID).toBe('dev-client');
    expect(payload.FRONTEND_URL).toBe('http://localhost:3000');
  });

  it('returns empty strings, never undefined, when nothing is configured', () => {
    const payload = buildRuntimeEnvPayload({});
    expect(payload).toEqual({
      OIDC_ISSUER: '',
      OIDC_CLIENT_ID: '',
      FRONTEND_URL: '',
      API_URL: '',
    });
  });
});

describe('buildRuntimeConfigScript', () => {
  it('emits a window.__ALFHEIM_ENV__ assignment', () => {
    const script = buildRuntimeConfigScript({ OIDC_ISSUER_URL: 'http://auth.alfheim.loegien.de', OIDC_CLIENT_ID: 'c' });
    expect(script.startsWith('window.__ALFHEIM_ENV__ = ')).toBe(true);
    expect(script.trimEnd().endsWith(';')).toBe(true);
    expect(script).toContain('"OIDC_ISSUER":"http://auth.alfheim.loegien.de"');
  });

  it('escapes angle brackets and ampersands so the payload cannot break out of the <script> tag', () => {
    const script = buildRuntimeConfigScript({ OIDC_ISSUER_URL: 'http://x</script><script>alert(1)</script>&y' });
    expect(script).not.toContain('</script>');
    expect(script).not.toContain('<script>alert');
    expect(script).toContain('\\u003C');
  });
});

describe('runtimeConfigGet', () => {
  it('responds with the script body, javascript content type and no-store caching', async () => {
    const res = runtimeConfigGet();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/javascript');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.text();
    expect(body.startsWith('window.__ALFHEIM_ENV__ = ')).toBe(true);
  });
});
