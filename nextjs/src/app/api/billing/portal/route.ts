/**
 * VeilForms - Billing Portal Endpoint
 * POST /api/billing/portal - Create customer portal session
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getUser } from "@/lib/storage";
import { createPortalSession } from "@/lib/stripe";
import { errorResponse, ErrorCodes } from "@/lib/errors";

export async function POST(req: NextRequest) {
  // Authenticate
  const auth = await authenticateRequest(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const user = await getUser(auth.user!.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const extUser = user as typeof user & { stripeCustomerId?: string };
    if (!extUser.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
    const returnUrl = `${baseUrl}/dashboard?section=settings`;

    const session = await createPortalSession(
      extUser.stripeCustomerId,
      returnUrl
    );

    return NextResponse.json({
      success: true,
      portalUrl: session.url,
    });
  } catch (err) {
    console.error("Portal error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Failed to create portal session",
    });
  }
}
