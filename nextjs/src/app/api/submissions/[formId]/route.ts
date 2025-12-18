/**
 * VeilForms - Submissions Management Endpoint
 * GET /api/submissions/:formId - List submissions
 * DELETE /api/submissions/:formId - Bulk delete all
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import {
  getForm,
  getSubmissions,
  deleteAllSubmissions,
  updateForm,
} from "@/lib/storage";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";

type RouteParams = { params: Promise<{ formId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { formId } = await params;

  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "submissions-api",
    maxRequests: 60,
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

  // Validate formId
  if (!isValidFormId(formId)) {
    return NextResponse.json(
      { error: "Valid formId required" },
      { status: 400 }
    );
  }

  try {
    // Get form and verify ownership
    const form = await getForm(formId);
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.userId !== auth.user!.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Fetch one extra to check for more
    let result = await getSubmissions(formId, limit + 1, offset);

    // Apply date filtering if specified
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Infinity;

      result.submissions = result.submissions.filter((s) => {
        const sub = s as { createdAt?: string; timestamp?: number; receivedAt?: number };
        const ts = sub.timestamp || sub.receivedAt || new Date(sub.createdAt || 0).getTime();
        return ts >= start && ts <= end;
      });
    }

    // Determine if there are more results
    const hasMore = result.submissions.length > limit;
    if (hasMore) {
      result.submissions = result.submissions.slice(0, limit);
    }

    // Generate next cursor
    const nextCursor =
      hasMore && result.submissions.length > 0
        ? Buffer.from(JSON.stringify({ offset: offset + limit })).toString(
            "base64"
          )
        : null;

    return NextResponse.json({
      formId,
      submissions: result.submissions,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore,
        nextCursor,
      },
    });
  } catch (err) {
    console.error("List submissions error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { formId } = await params;

  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "submissions-api",
    maxRequests: 60,
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

  // Validate formId
  if (!isValidFormId(formId)) {
    return NextResponse.json(
      { error: "Valid formId required" },
      { status: 400 }
    );
  }

  try {
    // Get form and verify ownership
    const form = await getForm(formId);
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    if (form.userId !== auth.user!.userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const deletedCount = await deleteAllSubmissions(formId);

    // Reset form submission count
    await updateForm(formId, { submissionCount: 0 });

    return NextResponse.json({ success: true, deletedCount });
  } catch (err) {
    console.error("Delete all submissions error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
