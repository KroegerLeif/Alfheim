/**
 * Server-side logic for the `<basePath>/runtime-config.js` route every Alfheim
 * frontend serves. Each app's route file should be a one-line re-export of
 * {@link runtimeConfigGet}, so the object shape, escaping and caching headers
 * stay identical everywhere.
 *
 * This module must never be imported from client components: it reads
 * `process.env` directly (the container's environment), not `window.__ALFHEIM_ENV__`.
 */

declare var process: { env: Record<string, string | undefined> };

export interface RuntimeEnvPayload {
  OIDC_ISSUER: string;
  OIDC_CLIENT_ID: string;
  FRONTEND_URL: string;
  API_URL: string;
}

/** Builds the runtime env object from process.env, applying the NEXT_PUBLIC_* dev fallback. */
export function buildRuntimeEnvPayload(env: Record<string, string | undefined> = process.env): RuntimeEnvPayload {
  return {
    OIDC_ISSUER: (env.OIDC_ISSUER_URL || env.NEXT_PUBLIC_OIDC_ISSUER || '').trim(),
    OIDC_CLIENT_ID: (env.OIDC_CLIENT_ID || env.NEXT_PUBLIC_OIDC_CLIENT_ID || '').trim(),
    FRONTEND_URL: (env.ALFHEIM_BASE_URL || env.NEXT_PUBLIC_FRONTEND_URL || '').trim(),
    API_URL: (env.NEXT_PUBLIC_API_URL || '').trim(),
  };
}

/** Escapes characters that could break out of the inline `<script>` this payload is written into. */
function escapeForScript(json: string): string {
  return json.replace(/</g, '\\u003C').replace(/>/g, '\\u003E').replace(/&/g, '\\u0026');
}

/** Renders the full `window.__ALFHEIM_ENV__ = {...};` script body. */
export function buildRuntimeConfigScript(env: Record<string, string | undefined> = process.env): string {
  const payload = buildRuntimeEnvPayload(env);
  return `window.__ALFHEIM_ENV__ = ${escapeForScript(JSON.stringify(payload))};`;
}

/**
 * The `GET <basePath>/runtime-config.js` route handler body.
 *
 * Every app's `app/runtime-config.js/route.ts` should be:
 * ```ts
 * export const dynamic = 'force-dynamic';
 * export { runtimeConfigGet as GET } from '@alfheim/shared';
 * ```
 */
export function runtimeConfigGet(): Response {
  return new Response(buildRuntimeConfigScript(), {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
