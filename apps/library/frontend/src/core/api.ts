import { createApiClient } from "@alfheim/shared";

/**
 * Library API client: the shared client with the browser session (bearer token, 401 refresh,
 * household headers), paths relative to the library API. Failed responses reject with the shared
 * `ApiError`, which `readApiError` turns into a localizable error code.
 */
export const libraryClient = createApiClient({
  basePath: "/api/v1/library",
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  session: true,
  timeoutMs: 10000,
});
