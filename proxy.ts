import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/jwt';

export async function proxy(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // 1. Verify Authentication
  let isAuthenticated = false;
  if (session) {
    try {
      // In Edge Runtime (Middleware), we use the jose decrypt or similar
      // Assuming decrypt handles the token validation
      await decrypt(session);
      isAuthenticated = true;
    } catch {
      // Invalid session
    }
  }

  // 2. Public Assets & Login API - Always Allow
  if (
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/static/')
  ) {
    return NextResponse.next();
  }

  // 3. Routing Logic for Unauthenticated Users
  if (!isAuthenticated) {
    // A. Root path or any other path guides to login (Redirect)
    if (pathname === '/login') {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 4. Routing Logic for Authenticated Users
  // If logged in and visiting login, go to home (manager)
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/login (allow login api)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/login|_next/static|_next/image|favicon.ico).*)',
  ],
};