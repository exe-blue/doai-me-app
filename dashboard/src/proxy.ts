import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // Get the session token from cookies
  const accessToken = req.cookies.get('sb-access-token')?.value;
  const refreshToken = req.cookies.get('sb-refresh-token')?.value;

  // Simple session check based on cookie presence
  const hasSession = !!(accessToken && refreshToken);

  // If accessing /dashboard without session, redirect to login
  if (req.nextUrl.pathname.startsWith('/dashboard') && !hasSession) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirectedFrom', req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If accessing /login with session, redirect to dashboard
  if (req.nextUrl.pathname === '/login' && hasSession) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};

