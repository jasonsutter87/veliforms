/**
 * VeilForms - Email Verification Endpoint
 * GET/POST /api/auth/verify - Verify email with token
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getEmailVerificationToken,
  deleteEmailVerificationToken,
  updateUser,
  getUser,
} from "@/lib/storage";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { errorResponse, ErrorCodes } from "@/lib/errors";

async function handleVerification(req: NextRequest, token: string | null) {
  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "verify",
    maxRequests: 10,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: "Verification token is required" },
      { status: 400, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Validate token
  const tokenData = await getEmailVerificationToken(token);
  if (!tokenData) {
    return NextResponse.json(
      {
        error: "Invalid or expired verification link",
        expired: true,
      },
      { status: 400, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Get user to check if already verified
  const user = await getUser(tokenData.email);
  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  if (user.emailVerified) {
    // Already verified, delete token and return success
    await deleteEmailVerificationToken(token);
    return NextResponse.json(
      {
        success: true,
        message: "Email already verified",
        alreadyVerified: true,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Mark email as verified
  await updateUser(tokenData.email, {
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
  });

  // Delete the used token (one-time use)
  await deleteEmailVerificationToken(token);

  if (process.env.NODE_ENV !== "production") {
    console.log(`Email verified for ${tokenData.email}`);
  }

  return NextResponse.json(
    {
      success: true,
      message: "Email verified successfully",
    },
    { headers: getRateLimitHeaders(rateLimit) }
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    return handleVerification(req, token);
  } catch (err) {
    console.error("Verify email error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Verification failed",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return handleVerification(req, body.token);
  } catch (err) {
    console.error("Verify email error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Verification failed",
    });
  }
}
