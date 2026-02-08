/**
 * Request correlation: X-Request-Id for all API responses.
 * Middleware sets x-request-id on request; routes call withRequestId(res, req) before return.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const HEADER = 'x-request-id';

export function getRequestId(request: NextRequest): string {
  return request.headers.get(HEADER) ?? crypto.randomUUID();
}

/** Call before returning from API route so response has X-Request-Id. */
export function withRequestId<T extends NextResponse>(
  response: T,
  request: NextRequest
): T {
  const id = getRequestId(request);
  response.headers.set('X-Request-Id', id);
  return response;
}
