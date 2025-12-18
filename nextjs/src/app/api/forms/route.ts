/**
 * VeilForms - Forms Management Endpoint
 * GET /api/forms - List user's forms
 * POST /api/forms - Create new form
 */

import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { createForm, getUserForms, getUserById } from "@/lib/storage";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { validateFormName, sanitizeString } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { generateKeyPair } from "@/lib/encryption";
import { getFormLimit } from "@/lib/subscription-limits";
import { createPrivateKeyDownloadToken } from "@/lib/private-key-tokens";

export const GET = authRoute(async (req, { user }) => {
  try {
    const forms = await getUserForms(user.userId);

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
}, { rateLimit: { keyPrefix: "forms-api", maxRequests: 30 } });

export const POST = authRoute(async (req, { user }) => {
  try {
    const body = await req.json();
    const { name, settings } = body;

    // Sanitize form name to prevent XSS
    const sanitizedName = sanitizeString(name, { maxLength: 100 });
    if (!sanitizedName) {
      return NextResponse.json(
        { error: "Form name is required" },
        { status: 400 }
      );
    }

    const nameValidation = validateFormName(sanitizedName);
    if (!nameValidation.valid) {
      return NextResponse.json(
        { error: nameValidation.error },
        { status: 400 }
      );
    }

    // Check form creation limits based on subscription
    const userRecord = await getUserById(user.userId);
    const subscription = userRecord?.subscription || "free";
    const limit = getFormLimit(subscription);

    // Get current form count (excluding deleted forms)
    const existingForms = await getUserForms(user.userId);
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
    const form = await createForm(user.userId, {
      name: sanitizedName,
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
      user.userId,
      AuditEvents.FORM_CREATED,
      {
        formId: form.id,
        formName: form.name,
      },
      auditCtx
    );

    // Generate one-time download token for private key
    const downloadToken = await createPrivateKeyDownloadToken(
      form.id,
      user.userId,
      JSON.stringify(privateKey)
    );

    // Build download URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
    const downloadUrl = `${baseUrl}/api/forms/${form.id}/download-key?token=${downloadToken}`;

    return NextResponse.json(
      {
        form: {
          id: form.id,
          name: form.name,
          status: "active",
          createdAt: form.createdAt,
          publicKey: form.publicKey,
          settings: form.settings,
        },
        privateKeyDownload: {
          url: downloadUrl,
          token: downloadToken,
          expiresIn: "15 minutes",
        },
        warning:
          "Download your private key immediately! The download link expires in 15 minutes and can only be used once. We cannot recover it.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create form error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, {
  rateLimit: { keyPrefix: "forms-api", maxRequests: 30 },
  csrf: true
});
