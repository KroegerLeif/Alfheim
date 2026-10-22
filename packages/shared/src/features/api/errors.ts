/**
 * Text for a failed request that is shown to the user as-is.
 *
 * ky (v2) wraps a failed `fetch` in a `NetworkError` whose own message embeds the request method
 * and URL. The browser's original message (for example `Failed to fetch`) is in `cause`, so that is
 * what users keep seeing, as before ky v2.
 */
export function getRequestErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'NetworkError' && error.cause instanceof Error) {
    return error.cause.message;
  }
  return error instanceof Error ? error.message : String(error);
}
