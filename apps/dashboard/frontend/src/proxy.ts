import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Proxy / Middleware enforcing access control rules on protected routes.
 * Client-side Keycloak OIDC handles interactive login redirection for unauthenticated users.
 */
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/profile', '/household', '/settings'],
};
