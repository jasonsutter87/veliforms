/**
 * VeilForms - User Data Export Endpoint
 * POST /api/user/export - Export all user data (GDPR Right to Portability)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { exportUserData } from "@/lib/gdpr";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { errorResponse, ErrorCodes } from "@/lib/errors";

export async function POST(req: NextRequest) {
  // Rate limit: 1 export per hour per user
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "user-export",
    maxRequests: 1,
    windowMs: 60 * 60 * 1000, // 1 hour
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Too many export requests. Please try again later.",
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
    // Export all user data
    const exportData = await exportUserData(userId);

    // Log the export
    const auditContext = getAuditContext(req);
    await logAudit(
      userId,
      AuditEvents.USER_DATA_EXPORTED,
      {
        formsCount: exportData.forms.length,
        apiKeysCount: exportData.apiKeys.length,
        auditLogsCount: exportData.auditLogs.length,
      },
      auditContext
    );

    // Return as downloadable JSON file
    const filename = `veilforms-data-export-${new Date().toISOString().split("T")[0]}.json`;
    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        ...getRateLimitHeaders(rateLimit),
      },
    });
  } catch (error) {
    console.error("User data export error:", error);

    // Log the failed export
    try {
      const auditContext = getAuditContext(req);
      await logAudit(
        userId,
        "user.data_export_failed",
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
