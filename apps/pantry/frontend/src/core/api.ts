import { createApiClient, resolveFrontendUrl } from "@alfheim/shared";

/**
 * Pantry API client: the shared client with the browser session (bearer token, 401 refresh,
 * household headers), paths relative to the pantry API. Failed responses reject with the shared
 * `ApiError`, which `readApiError` turns into a localizable message.
 */
export const pantryClient = createApiClient({
  basePath: "/pantry/api/v1",
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  session: true,
  timeoutMs: 10000,
});

/**
 * Public API of the shopping app, reached on the frontend origin (never through another app's database
 * network). The shopping frontend uses the same `/shopping/api/v1` ingress prefix, which Caddy forwards
 * to the shopping backend as `/api/v1`, so items are added with `POST shopping/items`. The runtime
 * `API_URL` only describes this app's own API, so it is deliberately not consulted here.
 */
export const shoppingClient = createApiClient({
  baseUrl: (typeof window !== "undefined" ? window.location.origin : resolveFrontendUrl()) + "/shopping/api/v1",
  session: true,
  timeoutMs: 10000,
});
