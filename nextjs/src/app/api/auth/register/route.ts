/**
 * VeilForms - Registration Endpoint
 * POST /api/auth/register - Create new user account
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authLogger } from "@/lib/logger";
import {
  hashPassword,
  createToken,
  validatePasswordStrength,
  PASSWORD_REQUIREMENTS,
} from "@/lib/auth";
import { createUser, getUser, createEmailVerificationToken } from "@/lib/storage";
import { sendEmailVerification } from "@/lib/email";
import {
  checkEmailRateLimit,
  getEmailRateLimitHeaders,
} from "@/lib/email-rate-limit";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { buildVerificationUrl } from "@/lib/url-helpers";

export async function POST(req: NextRequest) {
  // Rate limit: 3 requests per hour per IP
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "register",
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many registration attempts",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }

  let email = '';
  try {
    const body = await req.json();
    email = body.email;
    const { password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check email rate limit (5 verification emails per hour)
    const rateLimit = await checkEmailRateLimit(email, "verification");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: rateLimit.message,
          retryAfter: rateLimit.retryAfter,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
        {
          status: 429,
          headers: getEmailRateLimitHeaders(rateLimit, "verification"),
        }
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
        { status: 400 }
      );
    }

    // Check if user exists
    const existing = await getUser(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash);

    // Create email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    await createEmailVerificationToken(email, verificationToken);

    // Build verification URL
    const verifyUrl = buildVerificationUrl(verificationToken);

    // Send verification email (fire and forget)
    sendEmailVerification(email, verifyUrl).catch((err) => {
      authLogger.error({ err, email }, 'Verification email failed');
    });

    // Create JWT token
    const token = createToken({ userId: user.id, email: user.email });

    return NextResponse.json(
      {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          subscription: user.subscription,
          emailVerified: false,
        },
        message: "Please check your email to verify your account",
      },
      { status: 201 }
    );
  } catch (err) {
    authLogger.error({ err, email }, 'Registration failed');
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Registration failed",
    });
  }
}
