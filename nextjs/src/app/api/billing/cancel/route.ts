/**
 * VeilForms - Cancel Subscription Endpoint
 * POST /api/billing/cancel - Cancel subscription at period end
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getUser } from "@/lib/storage";
import { cancelSubscription, formatSubscriptionData } from "@/lib/stripe";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
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

    const extUser = user as typeof user & { stripeSubscriptionId?: string };
    if (!extUser.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription to cancel" },
        { status: 400 }
      );
    }

    const subscription = await cancelSubscription(
      extUser.stripeSubscriptionId,
      false
    );

    const subscriptionData = formatSubscriptionData(subscription);
    const auditCtx = getAuditContext(req);
    await logAudit(
      user.id,
      AuditEvents.SUBSCRIPTION_CANCELED,
      {
        subscriptionId: extUser.stripeSubscriptionId,
        cancelAt: subscriptionData.currentPeriodEnd,
      },
      auditCtx
    );

    return NextResponse.json({
      success: true,
      message:
        "Subscription will be canceled at the end of the billing period",
      cancelAt: subscriptionData.currentPeriodEnd,
    });
  } catch (err) {
    console.error("Cancel error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Failed to cancel subscription",
    });
  }
}
