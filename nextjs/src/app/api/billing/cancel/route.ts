/**
 * VeilForms - Cancel Subscription Endpoint
 * POST /api/billing/cancel - Cancel subscription at period end
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/storage";
import { cancelSubscription, formatSubscriptionData } from "@/lib/stripe";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { authRoute } from "@/lib/route-handler";

export const POST = authRoute(async (req: NextRequest, { user: authUser }) => {
  try {
    const user = await getUser(authUser.email);
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
});
