import createMiddleware from "next-intl/middleware";
import { locales, localePrefix } from "./navigation";

export default createMiddleware({
  defaultLocale: "en",
  locales,
  localePrefix,
});

export const config = {
  // Intercept all paths including the basePath-stripped root ("/") and locale prefixed paths.
  // Excludes Next.js internals, Vercel internals, and static file extensions.
  matcher: [
    "/",
    "/(de|en)/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
