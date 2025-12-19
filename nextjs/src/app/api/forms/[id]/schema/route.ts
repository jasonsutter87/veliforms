/**
 * VeilForms - Public Form Schema Endpoint
 * GET /api/forms/:id/schema - Get form schema for rendering (public, unauthenticated)
 */

import { NextRequest, NextResponse } from "next/server";
import { getForm } from "@/lib/storage";
import { isValidFormId } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: formId } = await params;

  // Rate limit: 30 requests per minute per IP
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "form-schema",
    maxRequests: 30,
    windowMs: 60000, // 1 minute
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  // Validate formId format
  if (!isValidFormId(formId)) {
    return errorResponse(ErrorCodes.VALIDATION_INVALID_FORMAT, {
      field: "formId",
      hint: "Form ID must be a valid format.",
    });
  }

  try {
    const form = await getForm(formId);

    if (!form) {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Form not found",
      });
    }

    // Check if form is deleted
    const formStatus = (form as { status?: string }).status;
    if (formStatus === "deleted") {
      return errorResponse(ErrorCodes.RESOURCE_NOT_FOUND, {
        message: "Form not found",
      });
    }

    // Check if form is paused
    if (formStatus === "paused") {
      return errorResponse(ErrorCodes.RESOURCE_FORBIDDEN, {
        message: "Form is not active",
        hint: "This form is currently paused.",
      });
    }

    // Return only public information needed for rendering
    return NextResponse.json({
      id: form.id,
      name: form.name,
      fields: form.fields || [],
      publicKey: form.publicKey,
      settings: {
        encryption: form.settings.encryption,
        spamProtection: {
          honeypot: form.settings.spamProtection?.honeypot || false,
          recaptcha: {
            enabled: form.settings.spamProtection?.recaptcha?.enabled || false,
            siteKey: form.settings.spamProtection?.recaptcha?.siteKey || "",
          },
        },
        branding: (form.settings as { branding?: unknown }).branding,
      },
    });
  } catch (err) {
    console.error("Get form schema error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
