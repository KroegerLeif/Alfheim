import { OidcConfig, OidcConfigError } from './oidcTypes';
import type { AlfheimRuntimeEnv, AlfheimRuntimeWindow } from '../config/runtimeConfig';

declare var process: any;

function readRuntimeEnv(): AlfheimRuntimeEnv | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as AlfheimRuntimeWindow).__ALFHEIM_ENV__;
}

function readProcessEnv(key: string): string | undefined {
  try {
    return typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
  } catch {
    return undefined;
  }
}

function normalizeBasePath(basePath: string): string {
  if (!basePath) return '';
  const trimmed = basePath.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed ? `/${trimmed}` : '';
}

/**
 * Builds the OIDC configuration for a frontend at runtime.
 *
 * The issuer and client id are read exclusively from the container's runtime
 * environment (`window.__ALFHEIM_ENV__`, injected via `<basePath>/runtime-config.js`),
 * with `NEXT_PUBLIC_*` build-time variables kept only as a development fallback.
 *
 * There is intentionally NO fallback to `window.location.origin` for the issuer:
 * an empty issuer is a misconfiguration and must surface as an explicit error,
 * never a silently wrong discovery URL.
 *
 * @throws {OidcConfigError} when the issuer or client id resolve to an empty string.
 */
export function loadOidcConfig(basePath = ''): OidcConfig {
  const runtime = readRuntimeEnv();

  const issuer = (
    runtime?.OIDC_ISSUER ||
    readProcessEnv('NEXT_PUBLIC_OIDC_ISSUER') ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  const clientId = (
    runtime?.OIDC_CLIENT_ID ||
    readProcessEnv('NEXT_PUBLIC_OIDC_CLIENT_ID') ||
    ''
  ).trim();

  if (!issuer) {
    throw new OidcConfigError(
      'OIDC issuer is not configured. Expected OIDC_ISSUER_URL in the container environment.',
    );
  }
  if (!clientId) {
    throw new OidcConfigError(
      'OIDC client id is not configured. Expected OIDC_CLIENT_ID in the container environment.',
    );
  }

  const normalizedBasePath = normalizeBasePath(basePath);
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : (runtime?.FRONTEND_URL || readProcessEnv('ALFHEIM_BASE_URL') || readProcessEnv('NEXT_PUBLIC_FRONTEND_URL') || '').trim();

  const redirectUri = `${origin}${normalizedBasePath}/`;

  return {
    issuer,
    clientId,
    redirectUri,
    scope: 'openid profile email offline_access',
  };
}
