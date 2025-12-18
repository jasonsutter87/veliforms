/**
 * VeilForms - Save Progress Endpoint
 * POST /api/save-progress - Save partial form submission for later
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";
import { getForm } from "@/lib/storage";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { isValidFormId, isValidEmail } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";

const PARTIAL_SUBMISSIONS_STORE = "vf-partial-submissions";
const MAX_PARTIAL_SUBMISSIONS = 1000;

interface PartialSubmission {
  resumeToken: string;
  formId: string;
  partialData: unknown;
  email: string | null;
  createdAt: number;
  expiresAt: number | null;
  meta: Record<string, unknown>;
}

interface PartialIndex {
  tokens: Array<{ token: string; ts: number }>;
}

/**
 * Generate a secure resume token
 */
function generateResumeToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

/**
 * Calculate expiry timestamp
 */
function calculateExpiry(expiryHours: number): number | null {
  if (!expiryHours || expiryHours === 0) {
    return null; // No expiry
  }
  return Date.now() + expiryHours * 60 * 60 * 1000;
}

/**
 * Update partial submission index for cleanup
 */
async function updatePartialIndex(
  store: ReturnType<typeof getStore>,
  formId: string,
  resumeToken: string
): Promise<void> {
  const indexKey = `_index_${formId}`;

  try {
    const index = ((await store.get(indexKey, { type: "json" })) as PartialIndex) || {
      tokens: [],
    };

    // Add new token to index
    index.tokens.unshift({
      token: resumeToken,
      ts: Date.now(),
    });

    // Keep index manageable and enforce limits
    if (index.tokens.length > MAX_PARTIAL_SUBMISSIONS) {
      // Remove oldest tokens
      const tokensToRemove = index.tokens.slice(MAX_PARTIAL_SUBMISSIONS);
      for (const item of tokensToRemove) {
        await store.delete(item.token).catch(() => {});
      }
      index.tokens = index.tokens.slice(0, MAX_PARTIAL_SUBMISSIONS);
    }

    await store.setJSON(indexKey, index);
  } catch (e) {
    console.warn("Partial index update failed:", e);
  }
}

export async function POST(req: NextRequest) {
  // Rate limit (20 per hour per IP to prevent abuse)
  const rateLimit = await checkRateLimit(req, {
    keyPrefix: "save-progress",
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  try {
    const body = await req.json();
    const { formId, partialData, email, meta } = body;

    // Validate required fields
    if (!formId || !partialData) {
      return NextResponse.json(
        { error: "Missing required fields: formId, partialData" },
        { status: 400 }
      );
    }

    // Validate formId format
    if (!isValidFormId(formId)) {
      return NextResponse.json(
        { error: "Invalid form ID format" },
        { status: 400 }
      );
    }

    // Get form and validate it exists
    const form = await getForm(formId);
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // Check if form is active
    if (form.status === "deleted" || form.status === "paused") {
      return NextResponse.json(
        { error: "Form is not accepting submissions" },
        { status: 403 }
      );
    }

    // Check if save progress is enabled for this form
    const saveProgress = (form.settings as { saveProgress?: { enabled?: boolean; emailResume?: boolean; expiryHours?: number } })?.saveProgress;
    if (!saveProgress?.enabled) {
      return NextResponse.json(
        { error: "Save progress feature not enabled for this form" },
        { status: 403 }
      );
    }

    // Validate encrypted partial data structure
    const encryptedKey = partialData.encryptedKey || partialData.key;
    if (
      !partialData.encrypted ||
      !encryptedKey ||
      !partialData.iv ||
      !partialData.version
    ) {
      return NextResponse.json(
        { error: "Invalid encrypted payload structure" },
        { status: 400 }
      );
    }

    // Normalize payload to use encryptedKey
    if (partialData.key && !partialData.encryptedKey) {
      partialData.encryptedKey = partialData.key;
      delete partialData.key;
    }

    // Validate email if provided
    if (email && saveProgress.emailResume) {
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: "Invalid email address" },
          { status: 400 }
        );
      }
    }

    // Get partial submissions store
    const store = getStore({
      name: PARTIAL_SUBMISSIONS_STORE,
      consistency: "strong",
    });

    // Generate unique resume token
    const resumeToken = generateResumeToken();

    // Calculate expiry
    const expiryHours = saveProgress.expiryHours || 72;
    const expiresAt = calculateExpiry(expiryHours);

    // Build partial submission record
    const partialSubmission: PartialSubmission = {
      resumeToken,
      formId,
      partialData,
      email: email || null,
      createdAt: Date.now(),
      expiresAt,
      meta: {
        sdkVersion: meta?.sdkVersion || "unknown",
        userAgent:
          req.headers.get("user-agent")?.substring(0, 200) || "unknown",
        region: req.headers.get("x-vercel-ip-country") || "unknown",
        ...meta,
      },
    };

    // Store partial submission
    await store.setJSON(resumeToken, partialSubmission);

    // Update index for this form (for cleanup)
    await updatePartialIndex(store, formId, resumeToken);

    // Generate resume URL
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
    const resumeUrl = `${baseUrl}/resume/${resumeToken}`;

    // Email sending would be handled here if implemented
    const emailSent = false;

    return NextResponse.json({
      success: true,
      resumeToken,
      resumeUrl,
      expiresAt,
      emailSent,
    });
  } catch (error) {
    console.error("Save progress error:", error);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Failed to save progress",
    });
  }
}
