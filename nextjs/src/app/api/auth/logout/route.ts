/**
 * VeilForms - Logout Endpoint
 * POST /api/auth/logout - Revoke user token
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getTokenFromHeader, revokeToken } from "@/lib/auth";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { authLogger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromHeader(req.headers);

    if (!token) {
      return NextResponse.json(
        { error: "No token provided" },
        { status: 401 }
      );
    }

    // Verify token is valid before revoking
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Revoke the token using persistent blocklist
    const result = await revokeToken(token);

    if (!result.success) {
      authLogger.error({ error: result.error, userId: decoded.userId }, "Token revocation failed");
      return errorResponse(ErrorCodes.SERVER_ERROR, {
        message: "Logout failed",
      });
    }

    authLogger.info({ userId: decoded.userId }, "User logged out successfully");
    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    authLogger.error({ err }, "Logout failed");
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Logout failed",
    });
  }
}
