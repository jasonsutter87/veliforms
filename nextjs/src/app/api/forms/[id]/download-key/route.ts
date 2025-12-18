/**
 * VeilForms - Private Key Download Endpoint
 * GET /api/forms/[id]/download-key - Download private key with one-time token
 */

import { NextRequest, NextResponse } from "next/server";
import { consumePrivateKeyDownloadToken } from "@/lib/private-key-tokens";
import { authenticateRequest } from "@/lib/auth";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limit: 10 requests per hour per IP
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "download-key",
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many download attempts",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }

  try {
    const formId = params.id;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Download token required" },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Authenticate user
    const auth = await authenticateRequest(req);
    if (auth.error || !auth.user) {
      return NextResponse.json(
        { error: auth.error || "Authentication required" },
        { status: auth.status || 401, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Consume token and get private key
    const tokenData = await consumePrivateKeyDownloadToken(token);

    if (!tokenData) {
      return NextResponse.json(
        {
          error: "Invalid or expired download token",
          hint: "Download tokens expire after 15 minutes and can only be used once.",
        },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Verify form ID matches
    if (tokenData.formId !== formId) {
      return NextResponse.json(
        { error: "Token does not match form ID" },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Verify user owns the form
    if (tokenData.userId !== auth.user.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Return private key
    return NextResponse.json(
      {
        formId: tokenData.formId,
        privateKey: tokenData.privateKey,
        warning:
          "This is the only time you will see this private key. Save it securely!",
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (err) {
    console.error("Download key error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
