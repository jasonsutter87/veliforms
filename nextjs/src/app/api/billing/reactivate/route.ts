/**
 * VeilForms - Reactivate Subscription Endpoint
 * POST /api/billing/reactivate - Reactivate canceled subscription
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getUser } from "@/lib/storage";
import { reactivateSubscription } from "@/lib/stripe";
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
        { error: "No subscription to reactivate" },
        { status: 400 }
      );
    }

    await reactivateSubscription(extUser.stripeSubscriptionId);

    const auditCtx = getAuditContext(req);
    await logAudit(
      user.id,
      AuditEvents.SUBSCRIPTION_REACTIVATED,
      {
        subscriptionId: extUser.stripeSubscriptionId,
      },
      auditCtx
    );

    return NextResponse.json({
      success: true,
      message: "Subscription reactivated successfully",
    });
  } catch (err) {
    console.error("Reactivate error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR, {
      message: "Failed to reactivate subscription",
    });
  }
}
