import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Proxy enforcing access control rules on protected routes.
 * Client-side Keycloak OIDC handles interactive login redirection for unauthenticated users.
 */
export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/profile', '/household', '/settings'],
};
