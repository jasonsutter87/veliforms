/**
 * VeilForms - Resend Verification Endpoint
 * POST /api/auth/resend-verification - Resend email verification
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  getUser,
  createEmailVerificationToken,
  getEmailVerificationTokenByEmail,
  deleteEmailVerificationToken,
} from "@/lib/storage";
import { sendEmailVerification } from "@/lib/email";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import {
  checkEmailRateLimit,
  getEmailRateLimitHeaders,
} from "@/lib/email-rate-limit";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { authLogger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  // Rate limit: 3 requests per minute per IP
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "resend-verification",
    maxRequests: 3,
    windowMs: 60000, // 1 minute
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests. Please wait before requesting another verification email.",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Check email-specific rate limit (5 per hour per email)
    const emailRateLimit = await checkEmailRateLimit(email, "verification");
    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          error: emailRateLimit.message,
          retryAfter: emailRateLimit.retryAfter,
          resetAt: new Date(emailRateLimit.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateLimit),
            ...getEmailRateLimitHeaders(emailRateLimit, "verification"),
          },
        }
      );
    }

    // Always return success to prevent email enumeration
    const successResponse = () =>
      NextResponse.json(
        {
          success: true,
          message:
            "If an unverified account exists, we sent a new verification email.",
        },
        { headers: getRateLimitHeaders(rateLimit) }
      );

    // Get user
    const user = await getUser(email);
    if (!user) {
      return successResponse();
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        {
          success: true,
          message: "Email is already verified",
          alreadyVerified: true,
        },
        { headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Delete existing token if any
    const existingToken = await getEmailVerificationTokenByEmail(email);
    if (existingToken) {
      await deleteEmailVerificationToken(existingToken.token);
    }

    // Generate new token
    const token = crypto.randomBytes(32).toString("hex");
    await createEmailVerificationToken(email, token);

    // Build verification URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
    const verifyUrl = `${baseUrl}/verify/?token=${token}`;

    // Send email
    try {
      await sendEmailVerification(email, verifyUrl);
    } catch (emailError) {
      authLogger.error({ emailError, email }, "Failed to send verification email");
    }

    return successResponse();
  } catch (err) {
    authLogger.error({ err }, "Resend verification failed");
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "An error occurred",
    });
  }
}
