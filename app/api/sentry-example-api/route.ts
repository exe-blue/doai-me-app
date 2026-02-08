/**
 * Sentry Example API Route
 * This endpoint is designed to throw an error for demonstration purposes.
 */
import { SentryExampleAPIError } from '@/lib/sentry-errors';

export async function GET() {
  console.log('Sentry example API called');
  
  throw new SentryExampleAPIError(
    'This error is raised on the backend called by the example page.',
  );
}
