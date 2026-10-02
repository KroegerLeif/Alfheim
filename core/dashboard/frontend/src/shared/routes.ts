/**
 * Routes actually served by this Next.js app. Every other Tier-1 core app,
 * Tier-2 stack app, or Tier-3 user bookmark target -- even one that starts
 * with "/" -- is owned by a different microfrontend proxied by Caddy and
 * must be opened with a full-page navigation (see NavAnchor), not
 * `next/link`, or Next's client router will fail to resolve it.
 */
const DASHBOARD_ROUTES = ['/', '/settings', '/under-construction'];

/**
 * True only when `path` is a route this dashboard app itself serves.
 * A leading "/" alone is not sufficient -- most core/stack apps are
 * reverse-proxied at same-origin paths (e.g. /pantry, /shopping) that this
 * app has no knowledge of.
 */
export function isDashboardRoute(path: string | undefined | null): boolean {
  if (!path || !path.startsWith('/')) return false;
  const pathname = path.split('?')[0].split('#')[0];
  return DASHBOARD_ROUTES.includes(pathname);
}
