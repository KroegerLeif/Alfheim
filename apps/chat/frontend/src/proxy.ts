import { createProxy } from "@alfheim/shared/i18n/proxy";

export default createProxy();

export const config = {
  // Next.js reads the matcher statically, so it stays a literal here. Skips API routes, Next.js internals and files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
