/**
 * Custom error classes for Sentry example demonstrations
 */

export class SentryExampleFrontendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SentryExampleFrontendError';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SentryExampleFrontendError);
    }
  }
}

export class SentryExampleAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SentryExampleAPIError';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SentryExampleAPIError);
    }
  }
}