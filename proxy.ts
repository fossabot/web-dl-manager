import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(_request: NextRequest) {
  // The application now treats itself as a standalone app.
  // Camouflage/Blog logic is handled by the external proxy (camouflage-server.mjs)
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/login|_next/static|_next/image|favicon.ico).*)',
  ],
};
