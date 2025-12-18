/**
 * VeilForms - Logout Endpoint
 * POST /api/auth/logout - Revoke user token
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, getTokenFromHeader, revokeToken } from "@/lib/auth";
import { errorResponse, ErrorCodes } from "@/lib/errors";

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
      console.error("Token revocation failed:", result.error);
      return errorResponse(ErrorCodes.SERVER_ERROR, {
        message: "Logout failed",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("Logout error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Logout failed",
    });
  }
}
