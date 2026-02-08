/**
 * Deploy Gate — API 라우트가 떠 있으면 무조건 200 (Vercel 확인용)
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withRequestId } from '@/lib/requestId';

export async function GET(req: NextRequest) {
  return withRequestId(NextResponse.json({ ok: true }, { status: 200 }), req);
}
