/**
 * VeilForms - Retry Utility with Exponential Backoff
 * Provides configurable retry logic for transient failures
 */

import { storageLogger } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: (error: unknown) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: () => true,
};

/**
 * Retry a function with exponential backoff
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function if successful
 * @throws The last error if all retries fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (attempt === opts.maxAttempts || !opts.retryableErrors(error)) {
        throw error;
      }

      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Check if an error is network-related and should be retried
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('fetch failed')
    );
  }
  return false;
}

/**
 * Storage-specific retry wrapper
 * Retries network errors but not validation errors
 */
export async function retryStorage<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  return retry(fn, {
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 2000,
    retryableErrors: (error) => {
      const shouldRetry = isNetworkError(error);

      if (shouldRetry && context) {
        storageLogger.warn(
          { error: error instanceof Error ? error.message : String(error), context },
          'Retrying storage operation due to transient error'
        );
      }

      return shouldRetry;
    },
  });
}

/**
 * HTTP request retry wrapper
 * Retries on 5xx errors and network issues
 */
export async function retryHttp<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retry(fn, {
    maxAttempts: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    retryableErrors: (error) => {
      // Retry on network errors
      if (isNetworkError(error)) {
        return true;
      }

      // Retry on 5xx HTTP errors (server errors)
      if (error instanceof Error && error.message.match(/\b5\d{2}\b/)) {
        return true;
      }

      return false;
    },
    ...options,
  });
}
