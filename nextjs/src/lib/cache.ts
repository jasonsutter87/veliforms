/**
 * VeilForms - In-Memory Cache
 * TTL-based caching to reduce database queries for frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttl: number;

  constructor(ttlSeconds: number) {
    this.ttl = ttlSeconds * 1000;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttl,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Cache instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const userCache = new SimpleCache<any>(60); // 1 minute
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const formCache = new SimpleCache<any>(60); // 1 minute

/**
 * Get user with caching
 * Wraps storage.getUser() with caching
 */
export async function getCachedUser(email: string): Promise<unknown> {
  const cached = userCache.get(email);
  if (cached !== null) return cached;

  // Import dynamically to avoid circular dependency
  const { getUser } = await import("./storage");
  const user = await getUser(email);
  if (user) {
    userCache.set(email, user);
  }
  return user;
}

/**
 * Get form with caching
 * Wraps storage.getForm() with caching
 */
export async function getCachedForm(formId: string): Promise<unknown> {
  const cached = formCache.get(formId);
  if (cached !== null) return cached;

  // Import dynamically to avoid circular dependency
  const { getForm } = await import("./storage");
  const form = await getForm(formId);
  if (form) {
    formCache.set(formId, form);
  }
  return form;
}

/**
 * Invalidate user cache
 */
export function invalidateUserCache(email: string): void {
  userCache.invalidate(email);
}

/**
 * Invalidate form cache
 */
export function invalidateFormCache(formId: string): void {
  formCache.invalidate(formId);
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  userCache.clear();
  formCache.clear();
}
