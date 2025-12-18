/**
 * VeilForms - Request Deduplication Utility
 * Prevents duplicate concurrent requests with the same key
 */

const pendingRequests = new Map<string, Promise<any>>();

/**
 * Deduplicate concurrent requests with the same key.
 * If a request with the given key is already pending, return that promise.
 * Otherwise, execute the request function and cache its promise.
 *
 * @param key - Unique identifier for the request
 * @param requestFn - Function that returns a promise for the request
 * @returns Promise that resolves with the request result
 *
 * @example
 * const data = await deduplicateRequest(
 *   `form-${formId}`,
 *   () => fetch(`/api/forms/${formId}`).then(r => r.json())
 * );
 */
export function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  // If request is already pending, return existing promise
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  // Execute request and cache the promise
  const promise = requestFn().finally(() => {
    // Clean up after request completes
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Clear a specific request from the pending cache
 * Useful for invalidating stale requests
 */
export function clearPendingRequest(key: string): void {
  pendingRequests.delete(key);
}

/**
 * Clear all pending requests
 * Useful for cleanup on unmount or navigation
 */
export function clearAllPendingRequests(): void {
  pendingRequests.clear();
}

/**
 * Check if a request is currently pending
 */
export function isRequestPending(key: string): boolean {
  return pendingRequests.has(key);
}
