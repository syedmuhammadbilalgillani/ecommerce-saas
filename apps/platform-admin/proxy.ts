import { NextResponse, type NextRequest } from 'next/server';

// Optimistic check only: the API validates the session on every call.
// This just avoids rendering admin pages for visitors with no session cookie at all.
const SESSION_COOKIE = 'posflow_platform_session';

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isLoginPage = request.nextUrl.pathname === '/login';

  if (!hasSession && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
