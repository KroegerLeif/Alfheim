import createMiddleware from "next-intl/middleware";
import { locales, localePrefix } from "./navigation";

/**
 * Route & Auth Proxy Middleware for Next.js 16.
 * Replaces deprecated middleware.ts in favor of src/proxy.ts.
 */
export default createMiddleware({
  defaultLocale: "en",
  locales,
  localePrefix,
});

export const config = {
  // Match all paths except internal Next.js assets, API routes, or files with extensions
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
