/**
 * VeilForms - Stripe Webhook Handler
 * POST /api/webhooks/stripe - Handle Stripe webhook events
 */

import { NextRequest, NextResponse } from "next/server";
import { updateUser, getUser, getUserById } from "@/lib/storage";
import {
  constructWebhookEvent,
  formatSubscriptionData,
  stripe,
} from "@/lib/stripe";
import { logAudit, AuditEvents } from "@/lib/audit";
import Stripe from "stripe";

// Disable body parsing for webhook signature verification
export const dynamic = "force-dynamic";

/**
 * Helper: Get user by Stripe customer ID
 */
async function getUserByStripeCustomer(
  customerId: string
): Promise<Awaited<ReturnType<typeof getUser>> | null> {
  try {
    const customer = (await stripe.customers.retrieve(
      customerId
    )) as Stripe.Customer;

    if (customer.metadata?.userId) {
      return await getUserById(customer.metadata.userId);
    }

    // Fallback: try email lookup
    if (customer.email) {
      return await getUser(customer.email);
    }
  } catch (error) {
    console.error("Error finding user by Stripe customer:", error);
  }

  return null;
}

/**
 * Handle new subscription created
 */
async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  const user = await getUserByStripeCustomer(subscription.customer as string);
  if (!user) {
    console.warn("User not found for subscription:", subscription.id);
    return;
  }

  const subscriptionData = formatSubscriptionData(subscription);

  await updateUser(user.email, {
    subscription: subscriptionData.plan,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscriptionData.status,
    subscriptionPeriodEnd: subscriptionData.currentPeriodEnd,
  } as Partial<typeof user>);

  await logAudit(user.id, AuditEvents.SUBSCRIPTION_CREATED, {
    plan: subscriptionData.plan,
    subscriptionId: subscription.id,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `Subscription created for user ${user.id}: ${subscriptionData.plan}`
    );
  }
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const user = await getUserByStripeCustomer(subscription.customer as string);
  if (!user) {
    console.warn("User not found for subscription update:", subscription.id);
    return;
  }

  const subscriptionData = formatSubscriptionData(subscription);
  const previousPlan = user.subscription;

  await updateUser(user.email, {
    subscription: subscriptionData.plan,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscriptionData.status,
    subscriptionPeriodEnd: subscriptionData.currentPeriodEnd,
    subscriptionCancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
  } as Partial<typeof user>);

  // Log if plan changed
  if (previousPlan !== subscriptionData.plan) {
    await logAudit(user.id, AuditEvents.SUBSCRIPTION_PLAN_CHANGED, {
      previousPlan,
      newPlan: subscriptionData.plan,
      subscriptionId: subscription.id,
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `Subscription updated for user ${user.id}: ${subscriptionData.plan}`
    );
  }
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const user = await getUserByStripeCustomer(subscription.customer as string);
  if (!user) {
    console.warn("User not found for subscription deletion:", subscription.id);
    return;
  }

  const previousPlan = user.subscription;

  // Downgrade to free plan
  await updateUser(user.email, {
    subscription: "free",
    stripeSubscriptionId: null,
    subscriptionStatus: "canceled",
    subscriptionPeriodEnd: null,
    subscriptionCancelAtPeriodEnd: false,
  } as Partial<typeof user>);

  await logAudit(user.id, AuditEvents.SUBSCRIPTION_CANCELED, {
    previousPlan,
    subscriptionId: subscription.id,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`Subscription deleted for user ${user.id}, downgraded to free`);
  }
}

/**
 * Handle successful payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // Cast to access subscription field which exists but types may not include
  const invoiceData = invoice as unknown as {
    subscription?: string | { id: string };
    customer?: string | { id: string };
    amount_paid?: number;
    currency?: string;
    id: string;
  };

  // Check if this is a subscription invoice
  const subscriptionId = typeof invoiceData.subscription === 'string'
    ? invoiceData.subscription
    : invoiceData.subscription?.id;
  if (!subscriptionId) return;

  const customerId = typeof invoiceData.customer === 'string'
    ? invoiceData.customer
    : invoiceData.customer?.id;
  if (!customerId) return;

  const user = await getUserByStripeCustomer(customerId);
  if (!user) return;

  await logAudit(user.id, AuditEvents.PAYMENT_SUCCEEDED, {
    amount: (invoiceData.amount_paid || 0) / 100,
    currency: invoiceData.currency || 'usd',
    invoiceId: invoiceData.id,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `Invoice paid for user ${user.id}: $${(invoiceData.amount_paid || 0) / 100}`
    );
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // Cast to access invoice fields
  const invoiceData = invoice as unknown as {
    customer?: string | { id: string };
    amount_due?: number;
    currency?: string;
    id: string;
    attempt_count?: number;
  };

  const customerId = typeof invoiceData.customer === 'string'
    ? invoiceData.customer
    : invoiceData.customer?.id;
  if (!customerId) return;

  const user = await getUserByStripeCustomer(customerId);
  if (!user) return;

  await updateUser(user.email, {
    subscriptionStatus: "past_due",
  } as Partial<typeof user>);

  await logAudit(user.id, AuditEvents.PAYMENT_FAILED, {
    amount: (invoiceData.amount_due || 0) / 100,
    currency: invoiceData.currency || 'usd',
    invoiceId: invoiceData.id,
    attemptCount: invoiceData.attempt_count || 0,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`Payment failed for user ${user.id}`);
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const planName = session.metadata?.planName;

  if (!userId || !planName) {
    console.warn("Missing metadata in checkout session");
    return;
  }

  await logAudit(userId, AuditEvents.BILLING_CHECKOUT_COMPLETED, {
    plan: planName,
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(`Checkout completed for user ${userId}: ${planName}`);
  }
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    console.error(
      "Webhook signature verification failed:",
      (err as Error).message
    );
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`Processing Stripe event: ${event.type}`);
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      default:
        if (process.env.NODE_ENV !== "production") {
          console.log(`Unhandled event type: ${event.type}`);
        }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
