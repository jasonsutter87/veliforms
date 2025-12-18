/**
 * VeilForms - Reset Password Endpoint
 * POST /api/auth/reset - Reset password with token
 */

import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  validatePasswordStrength,
  PASSWORD_REQUIREMENTS,
} from "@/lib/auth";
import {
  getPasswordResetToken,
  deletePasswordResetToken,
  updateUser,
} from "@/lib/storage";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { authLogger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  // Rate limit: 3 requests per minute per IP
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "password-reset",
    maxRequests: 3,
    windowMs: 60000, // 1 minute
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

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Validate password strength
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        {
          error: "Password does not meet requirements",
          details: passwordCheck.errors,
          requirements: PASSWORD_REQUIREMENTS,
        },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Validate token
    const tokenData = await getPasswordResetToken(token);
    if (!tokenData) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user's password
    const updated = await updateUser(tokenData.email, { passwordHash });
    if (!updated) {
      return errorResponse(ErrorCodes.SERVER_ERROR, {
        message: "Failed to update password",
      });
    }

    // Delete the used token (one-time use)
    await deletePasswordResetToken(token);

    authLogger.info({ email: tokenData.email }, "Password reset successful");

    return NextResponse.json(
      {
        success: true,
        message: "Password has been reset successfully",
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (err) {
    authLogger.error({ err }, "Password reset failed");
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "An error occurred",
    });
  }
}
