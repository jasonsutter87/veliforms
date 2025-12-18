/**
 * VeilForms - Audit Logs Endpoint
 * GET /api/audit-logs - List user's audit logs
 * GET /api/audit-logs?formId=xxx - List form-specific logs
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getAuditLogs, getFormAuditLogs } from "@/lib/audit";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { getForm } from "@/lib/storage";
import { errorResponse, ErrorCodes } from "@/lib/errors";

export async function GET(req: NextRequest) {
  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "audit-logs",
    maxRequests: 30,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const formId = searchParams.get("formId");
    const eventType = searchParams.get("event");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // If formId specified, verify ownership
    if (formId) {
      const form = await getForm(formId);
      if (!form || form.userId !== auth.user!.userId) {
        return NextResponse.json(
          { error: "Form not found or access denied" },
          { status: 404 }
        );
      }

      const result = await getFormAuditLogs(auth.user!.userId, formId, limit);
      return NextResponse.json(result);
    }

    // Get all audit logs for user
    const result = await getAuditLogs(
      auth.user!.userId,
      limit,
      offset,
      eventType
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("Audit logs error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
