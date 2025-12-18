/**
 * VeilForms - Forms Management Endpoint
 * GET /api/forms - List user's forms
 * POST /api/forms - Create new form
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createForm, getUserForms, getUserById } from "@/lib/storage";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { validateFormName } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";

// Form creation limits per subscription tier
const FORM_LIMITS: Record<string, number> = {
  free: 5,
  starter: 20,
  pro: 50,
  business: Infinity,
  enterprise: Infinity,
};

// Generate RSA key pair for form encryption
async function generateKeyPair(): Promise<{
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return { publicKey, privateKey };
}

export async function GET(req: NextRequest) {
  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "forms-api",
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
    const forms = await getUserForms(auth.user!.userId);

    // Remove sensitive data and filter deleted forms
    const sanitizedForms = forms
      .filter((f) => (f as { status?: string }).status !== "deleted")
      .map((form) => ({
        id: form.id,
        name: form.name,
        status: (form as { status?: string }).status || "active",
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
        submissionCount: form.submissionCount || 0,
        lastSubmissionAt: (form as { lastSubmissionAt?: string }).lastSubmissionAt,
        settings: {
          encryption: form.settings?.encryption,
          piiStrip: form.settings?.piiStrip,
          allowedOrigins: form.settings?.allowedOrigins,
        },
      }));

    return NextResponse.json({
      forms: sanitizedForms,
      total: sanitizedForms.length,
    });
  } catch (err) {
    console.error("List forms error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}

export async function POST(req: NextRequest) {
  // Rate limit
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "forms-api",
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

  // CSRF protection
  if (!validateCsrfToken(req)) {
    return NextResponse.json(
      { error: "CSRF token validation failed" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { name, settings } = body;

    const nameValidation = validateFormName(name);
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      );
    }

    // Check form creation limits based on subscription
    const user = await getUserById(auth.user!.userId);
    const subscription = user?.subscription || "free";
    const limit = FORM_LIMITS[subscription] || FORM_LIMITS.free;

    // Get current form count (excluding deleted forms)
    const existingForms = await getUserForms(auth.user!.userId);
    const activeFormCount = existingForms.filter(
      (f) => (f as { status?: string }).status !== "deleted"
    ).length;

    if (activeFormCount >= limit) {
      return NextResponse.json(
        {
          error: "Form creation limit reached",
          limit,
          current: activeFormCount,
          subscription,
          message:
            subscription === "free" || subscription === "starter"
              ? "Upgrade to Pro for up to 50 forms, or Business for unlimited forms"
              : subscription === "pro"
              ? "Upgrade to Business for unlimited forms"
              : "Contact support for assistance",
        },
        { status: 402 }
      );
    }

    // Generate encryption keys
    const { publicKey, privateKey } = await generateKeyPair();

    // Create form
    const form = await createForm(auth.user!.userId, {
      name: name.trim(),
      publicKey: JSON.stringify(publicKey),
      settings: {
        encryption: true,
        piiStrip: settings?.piiStrip || false,
        webhookUrl: settings?.webhookUrl || null,
        allowedOrigins: settings?.allowedOrigins || ["*"],
        spamProtection: {
          honeypot: settings?.spamProtection?.honeypot !== false,
          recaptcha: {
            enabled: settings?.spamProtection?.recaptcha?.enabled || false,
            siteKey: settings?.spamProtection?.recaptcha?.siteKey || "",
            secretKey: settings?.spamProtection?.recaptcha?.secretKey || "",
            threshold: settings?.spamProtection?.recaptcha?.threshold || 0.5,
          },
        },
        ...settings,
      },
    });

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      auth.user!.userId,
      AuditEvents.FORM_CREATED,
      {
        formId: form.id,
        formName: form.name,
      },
      auditCtx
    );

    return NextResponse.json(
      {
        form: {
          id: form.id,
          name: form.name,
          status: "active",
          createdAt: form.createdAt,
          publicKey: form.publicKey,
          privateKey: JSON.stringify(privateKey), // Only returned on creation!
          settings: form.settings,
        },
        warning:
          "Save your private key immediately! This is the only time it will be shown. We cannot recover it.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create form error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
