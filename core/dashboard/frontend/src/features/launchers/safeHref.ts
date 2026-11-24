/**
 * Returns `url` when it is an absolute http(s) URL without credentials, else `undefined`. The
 * backend already rejects anything else; this keeps a tile inert should a bad value ever arrive.
 */
export function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    if (parsed.username || parsed.password) return undefined;
    return url;
  } catch {
    // Not an absolute URL: render the tile without a link.
    return undefined;
  }
}
