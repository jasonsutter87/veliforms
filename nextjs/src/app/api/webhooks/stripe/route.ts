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
import { webhookLogger } from "@/lib/logger";
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
    webhookLogger.error({ error, customerId }, "Error finding user by Stripe customer");
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
    webhookLogger.warn({ subscriptionId: subscription.id, customerId: subscription.customer }, "User not found for subscription");
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

  webhookLogger.info({ userId: user.id, plan: subscriptionData.plan, subscriptionId: subscription.id }, "Subscription created");
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const user = await getUserByStripeCustomer(subscription.customer as string);
  if (!user) {
    webhookLogger.warn({ subscriptionId: subscription.id, customerId: subscription.customer }, "User not found for subscription update");
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

  webhookLogger.info({ userId: user.id, plan: subscriptionData.plan, previousPlan, subscriptionId: subscription.id }, "Subscription updated");
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const user = await getUserByStripeCustomer(subscription.customer as string);
  if (!user) {
    webhookLogger.warn({ subscriptionId: subscription.id, customerId: subscription.customer }, "User not found for subscription deletion");
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

  webhookLogger.info({ userId: user.id, previousPlan, subscriptionId: subscription.id }, "Subscription deleted, downgraded to free");
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

  webhookLogger.info({ userId: user.id, amount: (invoiceData.amount_paid || 0) / 100, currency: invoiceData.currency, invoiceId: invoiceData.id }, "Invoice paid");
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

  webhookLogger.warn({ userId: user.id, invoiceId: invoiceData.id, attemptCount: invoiceData.attempt_count }, "Payment failed");
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
    webhookLogger.warn({ sessionId: session.id }, "Missing metadata in checkout session");
    return;
  }

  await logAudit(userId, AuditEvents.BILLING_CHECKOUT_COMPLETED, {
    plan: planName,
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
  });

  webhookLogger.info({ userId, plan: planName, sessionId: session.id }, "Checkout completed");
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
    webhookLogger.error({ err }, "Webhook signature verification failed");
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  webhookLogger.debug({ eventType: event.type, eventId: event.id }, "Processing Stripe event");

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
        webhookLogger.debug({ eventType: event.type }, "Unhandled event type");
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    webhookLogger.error({ error, eventType: event.type, eventId: event.id }, "Webhook handler error");
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
