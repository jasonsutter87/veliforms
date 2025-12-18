/**
 * VeilForms - Get Subscription Status Endpoint
 * GET /api/billing/subscription - Get current subscription status
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getUser } from "@/lib/storage";
import {
  getPlanConfig,
  getPlanLimits,
  getSubscription,
  formatSubscriptionData,
} from "@/lib/stripe";
import { errorResponse, ErrorCodes } from "@/lib/errors";

export async function GET(req: NextRequest) {
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

    const planConfig = getPlanConfig(user.subscription || "free");
    const limits = getPlanLimits(user.subscription || "free");

    // If user has active subscription, get details from Stripe
    let subscriptionDetails = null;
    const extUser = user as typeof user & { stripeSubscriptionId?: string };
    if (extUser.stripeSubscriptionId) {
      const subscription = await getSubscription(extUser.stripeSubscriptionId);
      if (subscription) {
        subscriptionDetails = formatSubscriptionData(subscription);
      }
    }

    return NextResponse.json({
      success: true,
      subscription: {
        plan: user.subscription || "free",
        planName: planConfig.name,
        monthlyPrice: planConfig.monthlyPrice,
        limits,
        status:
          subscriptionDetails?.status ||
          (user.subscription === "free" ? "active" : "unknown"),
        ...subscriptionDetails,
      },
    });
  } catch (err) {
    console.error("Get subscription error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}
