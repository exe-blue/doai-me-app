/**
 * DoAi.Me MVP Orchestration v1
 * No ALL execution from frontend — backend API only
 * JWT auth for frontend; shared secret for node APIs (handled in route)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Node API routes use X-Node-Auth (shared secret); skip JWT check
  if (req.nextUrl.pathname.startsWith('/api/nodes/')) {
    return NextResponse.next();
  }

  // TODO: Add JWT auth for frontend routes when UI exists
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
