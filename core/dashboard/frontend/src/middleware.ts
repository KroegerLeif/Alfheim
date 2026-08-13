import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['de', 'en', 'pl'];

/**
 * Next.js Middleware handling locale-prefixed path rewrites and access controls.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if pathname starts with a locale prefix (e.g. /de/household)
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    const parts = pathname.split('/');
    const locale = parts[1];
    const targetPath = '/' + parts.slice(2).join('/');

    const response = NextResponse.rewrite(new URL(targetPath, request.url));
    // Set cookie NEXT_LOCALE matching the route prefix
    response.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - file extensions like .png, .jpg (assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)',
  ],
};
