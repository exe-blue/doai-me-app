/**
 * Sentry Example API Route
 * This endpoint is designed to throw an error for demonstration purposes.
 */
import { NextResponse } from 'next/server';
import { SentryExampleAPIError } from '@/lib/sentry-errors';

export async function GET() {
  console.log('Sentry example API called');
  
  // Throw the example error
  throw new SentryExampleAPIError(
    'This error is raised on the backend called by the example page.',
  );
  
  // This code is unreachable, but kept for clarity
  return NextResponse.json({ success: true }, { status: 200 });
}