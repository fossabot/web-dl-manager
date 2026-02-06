import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from './lib/auth';

export async function middleware(request: NextRequest) {
  const session = request.cookies.get('session')?.value;

  if (request.nextUrl.pathname.startsWith('/login')) {
    if (session) {
      try {
        await decrypt(session);
        return NextResponse.redirect(new URL('/', request.url));
      } catch (e) {
        // Invalid session, allow login
      }
    }
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await decrypt(session);
    return NextResponse.next();
  } catch (e) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|static).*)',
  ],
};
