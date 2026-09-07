/**
 * Runtime environment and URL resolution utilities for Alfheim applications.
 * Ensures strict separation between local development (.localhost) and production
 * environments without baking localhost defaults into compiled client bundles.
 */

declare var process: any;

export interface AlfheimRuntimeWindow extends Window {
  __ALFHEIM_ENV__?: {
    KEYCLOAK_URL?: string;
    FRONTEND_URL?: string;
    API_URL?: string;
  };
}

/**
 * Checks whether the current runtime environment is local development.
 */
export function isLocalEnvironment(): boolean {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local')
    );
  }
  const env = (process.env.ENVIRONMENT || process.env.NODE_ENV || '').toLowerCase();
  return env === 'development' || env === 'dev' || env === 'test' || env === 'testing';
}

/**
 * Resolves the browser-facing Keycloak IAM URL dynamically.
 *
 * Resolution order:
 * 1. window.__ALFHEIM_ENV__.KEYCLOAK_URL (Runtime SSR injection from container env)
 * 2. process.env.NEXT_PUBLIC_KEYCLOAK_URL
 *    - Guard: If the browser is on a non-local domain (e.g., alfheim.loegien.de) but
 *      the variable contains 'localhost', the baked-in dev default is overridden with
 *      the current origin (`${window.location.origin}/auth`).
 * 3. Browser origin fallback: `${window.location.origin}/auth`
 * 4. Server-side environment variables: KEYCLOAK_PUBLIC_URL or `${ALFHEIM_BASE_URL}/auth`
 * 5. Localhost fallback for isolated unit testing
 */
export function resolveKeycloakUrl(): string {
  if (typeof window !== 'undefined') {
    const runtimeWindow = window as unknown as AlfheimRuntimeWindow;
    if (runtimeWindow.__ALFHEIM_ENV__?.KEYCLOAK_URL && runtimeWindow.__ALFHEIM_ENV__.KEYCLOAK_URL.trim() !== '') {
      return runtimeWindow.__ALFHEIM_ENV__.KEYCLOAK_URL.trim();
    }

    const envUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL;
    if (envUrl && envUrl.trim() !== '') {
      const isBrowserLocal = isLocalEnvironment();
      const isEnvLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
      if (!isBrowserLocal && isEnvLocal) {
        // Build-time default leaked into production client bundle - dynamically derive from origin!
        return `${window.location.origin}/auth`;
      }
      return envUrl.trim();
    }

    // Dynamic browser resolution: Caddy serves Keycloak at /auth on the frontend domain
    return `${window.location.origin}/auth`;
  }

  // Server-side / SSR resolution
  if (process.env.KEYCLOAK_PUBLIC_URL && process.env.KEYCLOAK_PUBLIC_URL.trim() !== '') {
    return process.env.KEYCLOAK_PUBLIC_URL.trim();
  }
  if (process.env.NEXT_PUBLIC_KEYCLOAK_URL && process.env.NEXT_PUBLIC_KEYCLOAK_URL.trim() !== '') {
    return process.env.NEXT_PUBLIC_KEYCLOAK_URL.trim();
  }
  if (process.env.ALFHEIM_BASE_URL && process.env.ALFHEIM_BASE_URL.trim() !== '') {
    const base = process.env.ALFHEIM_BASE_URL.trim().replace(/\/+$/, '');
    return `${base}/auth`;
  }

  return 'http://api.alfheim.loegien.localhost/auth';
}

/**
 * Resolves the Frontend / Dashboard root URL.
 */
export function resolveFrontendUrl(): string {
  if (typeof window !== 'undefined') {
    const runtimeWindow = window as unknown as AlfheimRuntimeWindow;
    if (runtimeWindow.__ALFHEIM_ENV__?.FRONTEND_URL && runtimeWindow.__ALFHEIM_ENV__.FRONTEND_URL.trim() !== '') {
      return runtimeWindow.__ALFHEIM_ENV__.FRONTEND_URL.trim();
    }

    const envUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
    if (envUrl && envUrl.trim() !== '') {
      const isBrowserLocal = isLocalEnvironment();
      const isEnvLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
      if (!isBrowserLocal && isEnvLocal) {
        return window.location.origin;
      }
      return envUrl.trim();
    }

    return window.location.origin;
  }

  if (process.env.NEXT_PUBLIC_FRONTEND_URL && process.env.NEXT_PUBLIC_FRONTEND_URL.trim() !== '') {
    return process.env.NEXT_PUBLIC_FRONTEND_URL.trim();
  }
  if (process.env.ALFHEIM_BASE_URL && process.env.ALFHEIM_BASE_URL.trim() !== '') {
    return process.env.ALFHEIM_BASE_URL.trim();
  }

  return 'http://alfheim.loegien.localhost';
}

/**
 * Resolves an API service URL dynamically.
 * Relative endpoints like `/api/v1/pantry` or `/pantry/api/v1` are resolved
 * against the current origin in the browser, eliminating cross-origin mismatches.
 */
export function resolveApiUrl(defaultPath: string, envVar?: string): string {
  if (typeof window !== 'undefined') {
    const runtimeWindow = window as unknown as AlfheimRuntimeWindow;
    if (runtimeWindow.__ALFHEIM_ENV__?.API_URL && runtimeWindow.__ALFHEIM_ENV__.API_URL.trim() !== '') {
      return runtimeWindow.__ALFHEIM_ENV__.API_URL.trim();
    }

    if (envVar && envVar.trim() !== '') {
      const isBrowserLocal = isLocalEnvironment();
      const isEnvLocal = envVar.includes('localhost') || envVar.includes('127.0.0.1');
      if (!isBrowserLocal && isEnvLocal) {
        return sanitizePath(defaultPath);
      }
      return envVar.trim();
    }

    return sanitizePath(defaultPath);
  }

  if (envVar && envVar.trim() !== '') {
    return envVar.trim();
  }

  const base = (
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    process.env.ALFHEIM_BASE_URL ||
    'http://alfheim.loegien.localhost'
  ).trim().replace(/\/+$/, '');

  const path = defaultPath.startsWith('/') ? defaultPath : `/${defaultPath}`;
  return `${base}${path}`;
}

function sanitizePath(path: string): string {
  if (typeof window !== 'undefined' && path.startsWith('/')) {
    return `${window.location.origin}${path}`;
  }
  return path;
}
