/**
 * VeilForms - Billing Checkout Endpoint
 * POST /api/billing/checkout - Create checkout session
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser, updateUser } from "@/lib/storage";
import {
  createCheckoutSession,
  getPlanConfig,
} from "@/lib/stripe";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { authRoute } from "@/lib/route-handler";

export const POST = authRoute(async (req: NextRequest, { user: authUser }) => {
  try {
    const user = await getUser(authUser.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { plan } = body;

    // Validate plan
    const planConfig = getPlanConfig(plan);
    if (!planConfig || !planConfig.priceId) {
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 }
      );
    }

    // Check if user is already on this plan
    if (user.subscription === plan) {
      return NextResponse.json(
        { error: "You are already subscribed to this plan" },
        { status: 400 }
      );
    }

    // Create success and cancel URLs
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
    const successUrl = `${baseUrl}/dashboard?billing=success&plan=${plan}`;
    const cancelUrl = `${baseUrl}/dashboard?billing=canceled`;

    const session = await createCheckoutSession({
      user,
      planName: plan,
      successUrl,
      cancelUrl,
    });

    // Update user with Stripe customer ID if new
    const extUser = user as typeof user & { stripeCustomerId?: string };
    if (session.customer && !extUser.stripeCustomerId) {
      await updateUser(user.email, {
        stripeCustomerId: session.customer as string,
      } as Partial<typeof user>);
    }

    const auditCtx = getAuditContext(req);
    await logAudit(
      user.id,
      AuditEvents.BILLING_CHECKOUT_STARTED,
      {
        plan,
        sessionId: session.id,
      },
      auditCtx
    );

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: (err as Error).message || "Failed to create checkout session",
    });
  }
});
