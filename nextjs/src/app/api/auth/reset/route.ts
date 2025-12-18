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

export async function POST(req: NextRequest) {
  // Rate limit for password reset (5 per minute)
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "reset",
    maxRequests: 5,
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

    if (process.env.NODE_ENV !== "production") {
      console.log(`Password reset successful for ${tokenData.email}`);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Password has been reset successfully",
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
  } catch (err) {
    console.error("Reset password error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "An error occurred",
    });
  }
}
