/**
 * VeilForms - Idempotency Key Management
 * Prevents duplicate form submissions by tracking idempotency keys
 */

import { getStore } from "@netlify/blobs";
import { NextRequest } from "next/server";

const IDEMPOTENCY_STORE = "vf-idempotency";
const TTL_24_HOURS = 24 * 60 * 60 * 1000; // milliseconds

interface IdempotencyData {
  key: string;
  formId: string;
  response: unknown;
  createdAt: number;
}

interface IdempotencyCheckResult {
  exists: boolean;
  response?: unknown;
  createdAt?: number;
  age?: number;
}

type IdempotencyHeaders = Record<string, string>;

/**
 * Check if idempotency key was already used
 */
export async function checkIdempotencyKey(
  key: string,
  formId: string
): Promise<IdempotencyCheckResult> {
  if (!key) {
    return { exists: false };
  }

  // Validate key format
  if (!isValidIdempotencyKey(key)) {
    throw new Error(
      "Invalid idempotency key format. Must be 16-128 alphanumeric characters, dashes, or underscores."
    );
  }

  const store = getStore({ name: IDEMPOTENCY_STORE, consistency: "strong" });
  const storageKey = `${formId}_${key}`;

  try {
    const data = (await store.get(storageKey, { type: "json" })) as IdempotencyData | null;

    if (!data) {
      return { exists: false };
    }

    const now = Date.now();
    const age = now - data.createdAt;

    // Check if TTL expired (24 hours)
    if (age > TTL_24_HOURS) {
      // Expired - delete and allow request
      await store.delete(storageKey);
      return { exists: false };
    }

    // Key exists and is valid
    return {
      exists: true,
      response: data.response,
      createdAt: data.createdAt,
      age,
    };
  } catch (error) {
    console.error("Idempotency key check error:", error);
    // On error, allow the request (fail open)
    return { exists: false };
  }
}

/**
 * Store idempotency key with response
 */
export async function storeIdempotencyKey(
  key: string,
  formId: string,
  response: unknown
): Promise<void> {
  if (!key) {
    return;
  }

  const store = getStore({ name: IDEMPOTENCY_STORE, consistency: "strong" });
  const storageKey = `${formId}_${key}`;

  const data: IdempotencyData = {
    key,
    formId,
    response,
    createdAt: Date.now(),
  };

  try {
    await store.setJSON(storageKey, data);
    await addToIdempotencyIndex(formId, storageKey, data.createdAt);
  } catch (error) {
    console.error("Failed to store idempotency key:", error);
    // Non-critical - don't throw
  }
}

/**
 * Add to idempotency index for tracking and cleanup
 */
async function addToIdempotencyIndex(
  formId: string,
  key: string,
  timestamp: number
): Promise<void> {
  const store = getStore({ name: IDEMPOTENCY_STORE, consistency: "strong" });
  const indexKey = `index_${formId}`;

  try {
    const index = ((await store.get(indexKey, { type: "json" })) as {
      keys: Array<{ key: string; ts: number }>;
    }) || { keys: [] };

    // Add new key
    index.keys.push({
      key,
      ts: timestamp,
    });

    // Keep index manageable (last 1000 entries)
    if (index.keys.length > 1000) {
      index.keys = index.keys.slice(-1000);
    }

    await store.setJSON(indexKey, index);
  } catch (error) {
    console.warn("Idempotency index update error:", error);
  }
}

/**
 * Validate idempotency key format
 */
function isValidIdempotencyKey(key: string): boolean {
  if (typeof key !== "string") {
    return false;
  }

  // Must be 16-128 characters
  if (key.length < 16 || key.length > 128) {
    return false;
  }

  // Only alphanumeric, dashes, and underscores
  return /^[a-zA-Z0-9_-]+$/.test(key);
}

/**
 * Extract idempotency key from request headers
 */
export function getIdempotencyKeyFromRequest(req: NextRequest): string | null {
  return (
    req.headers.get("x-idempotency-key") ||
    req.headers.get("idempotency-key") ||
    null
  );
}

/**
 * Get idempotency response headers
 */
export function getIdempotencyHeaders(
  result: IdempotencyCheckResult
): IdempotencyHeaders {
  if (!result.exists || !result.age || !result.createdAt) {
    return {};
  }

  return {
    "X-Idempotent-Replay": "true",
    "X-Idempotency-Age": Math.floor(result.age / 1000).toString(),
    "X-Idempotency-Created": new Date(result.createdAt).toISOString(),
  };
}

/**
 * Cleanup expired idempotency keys (scheduled job)
 */
export async function cleanupExpiredIdempotencyKeys(
  formId: string | null = null
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const store = getStore({ name: IDEMPOTENCY_STORE, consistency: "strong" });
  const now = Date.now();
  let deletedCount = 0;

  try {
    // If formId provided, clean up that form's keys
    if (formId) {
      const indexKey = `index_${formId}`;
      const index = (await store.get(indexKey, { type: "json" })) as {
        keys: Array<{ key: string; ts: number }>;
      } | null;

      if (index?.keys) {
        for (const item of index.keys) {
          const age = now - item.ts;
          if (age > TTL_24_HOURS) {
            await store.delete(item.key);
            deletedCount++;
          }
        }

        // Update index to remove deleted keys
        index.keys = index.keys.filter((item) => now - item.ts <= TTL_24_HOURS);
        await store.setJSON(indexKey, index);
      }
    }

    return { success: true, deletedCount };
  } catch (error) {
    console.error("Idempotency cleanup error:", error);
    return { success: false, deletedCount: 0, error: (error as Error).message };
  }
}
