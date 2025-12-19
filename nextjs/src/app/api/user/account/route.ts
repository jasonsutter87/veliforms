/**
 * VeilForms - Account Deletion Endpoint
 * DELETE /api/user/account - Delete user account and all data (GDPR Right to Erasure)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, verifyPassword } from "@/lib/auth";
import { deleteUserData, sendAccountDeletionEmail } from "@/lib/gdpr";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { getUserById } from "@/lib/storage";
import { revokeToken } from "@/lib/token-blocklist";

export async function DELETE(req: NextRequest) {
  // Rate limit: 5 deletion attempts per hour
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "account-deletion",
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many deletion requests. Please try again later.",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = auth.user!.userId;

  try {
    // Parse request body
    const body = await req.json();
    const { password, confirmation } = body;

    // Require password confirmation for non-OAuth users
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify password (for password-based accounts)
    if (user.passwordHash) {
      if (!password) {
        return NextResponse.json(
          { error: "Password confirmation required" },
          { status: 400 }
        );
      }

      const passwordValid = await verifyPassword(password, user.passwordHash);
      if (!passwordValid) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
    }

    // Require explicit confirmation
    if (confirmation !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        {
          error:
            'Please type "DELETE MY ACCOUNT" to confirm account deletion',
        },
        { status: 400 }
      );
    }

    // Log the deletion BEFORE actually deleting (so we have the audit log)
    const auditContext = getAuditContext(req);
    await logAudit(
      userId,
      AuditEvents.USER_ACCOUNT_DELETED,
      {
        email: user.email,
        formsCount: user.forms?.length || 0,
        subscription: user.subscription,
      },
      auditContext
    );

    // Delete all user data
    const deletionResult = await deleteUserData(userId, true);

    // Send confirmation email
    try {
      await sendAccountDeletionEmail(user.email, user.name || undefined);
    } catch (error) {
      console.error("Failed to send deletion confirmation email:", error);
      // Continue even if email fails
    }

    // Revoke the current token
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      try {
        await revokeToken(token);
      } catch {
        // Ignore token revocation errors
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account successfully deleted",
        deleted: deletionResult.deleted,
      },
      {
        status: 200,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  } catch (error) {
    console.error("Account deletion error:", error);

    // Try to log the failed deletion
    try {
      const auditContext = getAuditContext(req);
      await logAudit(
        userId,
        "user.account_deletion_failed",
        {
          error: (error as Error).message,
        },
        auditContext
      );
    } catch {
      // Ignore audit log failure
    }

    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
