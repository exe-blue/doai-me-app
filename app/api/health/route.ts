/**
 * Deploy Gate — API 라우트가 떠 있으면 무조건 200 (Vercel 확인용)
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
