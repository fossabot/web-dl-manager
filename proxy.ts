import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/jwt';

export async function proxy(request: NextRequest) {
  const session = request.cookies.get('session')?.value;
  const path = request.nextUrl.pathname;

  // 1. Verify Session
  let isAuthenticated = false;
  if (session) {
    try {
      await decrypt(session);
      isAuthenticated = true;
    } catch {
      // Invalid session
    }
  }

  // 2. Handle Login Page
  if (path.startsWith('/login')) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // 3. Handle Root Path
  if (path === '/') {
    if (!isAuthenticated) {
      // Not logged in on main port -> Go to login
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // 4. Protect other routes (exclude public assets and apis that don't need auth)
  // Note: API auth is usually handled inside the API route itself, but we can block here too.
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/login (allow login api)
     * - camouflage (static site assets)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static (public static files)
     */
    '/((?!api/login|camouflage|_next/static|_next/image|favicon.ico|static).*)',
  ],
};