/**
 * VeilForms - API Key Revocation Endpoint
 * DELETE /api/api-keys/:keyId - Revoke API key
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { authenticateRequest } from "@/lib/auth";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { errorResponse, ErrorCodes } from "@/lib/errors";

const API_KEYS_STORE = "vf-api-keys";

interface ApiKeyData {
  userId: string;
  name: string;
  prefix: string;
  keyHash: string;
  permissions: string[];
  createdAt: string;
  lastUsed: string | null;
}

type RouteParams = { params: Promise<{ keyId: string }> };

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { keyId } = await params;

  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "api-keys",
    maxRequests: 20,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const store = getStore({ name: API_KEYS_STORE, consistency: "strong" });

  try {
    // Verify key belongs to user
    const keyData = (await store.get(keyId, { type: "json" })) as ApiKeyData | null;

    if (!keyData) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    if (keyData.userId !== auth.user!.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete the key
    await store.delete(keyId);

    // Remove from user's key list
    const userKeysKey = `user_keys_${auth.user!.userId}`;
    let userKeys: string[] = [];
    try {
      userKeys =
        ((await store.get(userKeysKey, { type: "json" })) as string[] | null) ||
        [];
    } catch {
      userKeys = [];
    }
    userKeys = userKeys.filter((k) => k !== keyId);
    await store.setJSON(userKeysKey, userKeys);

    return NextResponse.json({
      success: true,
      revoked: keyId,
    });
  } catch (err) {
    console.error("Revoke API key error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
