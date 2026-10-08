/**
 * Message to show for a failed request. API failures are thrown as plain `{ status, code, message }`
 * objects (see `core/api.ts`), so this accepts anything with a non-empty string `message` and uses
 * the already localized `fallback` otherwise.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}
