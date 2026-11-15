import { ApiError, createApiClient, type ApiRequestInit } from "@alfheim/shared";

export { ApiError };

/**
 * Chat API client: the shared client with the browser session (bearer token, one refresh on
 * 401, `X-Household-ID`, which the chat backend requires on every route) and the default
 * timeout. The SSE stream opts out of the timeout per request.
 */
export const chatApi = createApiClient({
  basePath: "/api/v1/chat",
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  session: true,
});

/** JSON request against the chat API; rejects with `ApiError` on a non-2xx response. */
export function request<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return chatApi.request(path, { ...init, headers }).json<T>();
}
