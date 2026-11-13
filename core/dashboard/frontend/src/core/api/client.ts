import { createApiClient } from '@alfheim/shared';

/**
 * Dashboard API client: the shared client with the browser session (bearer token, one refresh on
 * 401, `X-Household-ID`, household error reporting) and the default timeout. Paths are relative
 * to `/api/v1`.
 */
export const api = createApiClient({
  basePath: '/api/v1',
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  session: true,
});
