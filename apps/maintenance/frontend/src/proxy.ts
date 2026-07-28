import createMiddleware from "next-intl/middleware";
import { locales, localePrefix } from "./navigation";

export default createMiddleware({
  defaultLocale: "en",
  locales,
  localePrefix,
});

export const config = {
  // Match all paths except internal Next.js assets, API routes, or files (like images, favicon, robots.txt)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
