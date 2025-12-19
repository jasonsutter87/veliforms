/**
 * API Integration Tests - Billing Routes
 * Tests for /api/billing/* endpoints
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Stripe before importing routes
vi.mock('@/lib/stripe', () => ({
  getPlanConfig: vi.fn(),
  getPlanLimits: vi.fn(),
  createCheckoutSession: vi.fn(),
  getSubscription: vi.fn(),
  formatSubscriptionData: vi.fn(),
  cancelSubscription: vi.fn(),
  createPortalSession: vi.fn(),
  reactivateSubscription: vi.fn(),
}));

vi.mock('@/lib/storage', () => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(),
  getAuditContext: vi.fn(),
  AuditEvents: {
    BILLING_CHECKOUT_STARTED: 'billing.checkout_started',
    SUBSCRIPTION_CANCELED: 'subscription.canceled',
    SUBSCRIPTION_REACTIVATED: 'subscription.reactivated',
  },
}));

import { POST as checkoutPOST } from '../billing/checkout/route';
import { GET as subscriptionGET } from '../billing/subscription/route';
import { POST as cancelPOST } from '../billing/cancel/route';
import { POST as portalPOST } from '../billing/portal/route';
import { POST as reactivatePOST } from '../billing/reactivate/route';
import {
  createMockRequest,
  createAuthenticatedRequest,
  getResponseJson,
} from '../../../../__tests__/helpers/api.helper';
import { createTestUser } from '../../../../__tests__/factories/user.factory';
import * as storage from '@/lib/storage';
import * as stripe from '@/lib/stripe';
import * as audit from '@/lib/audit';

describe('Billing API Routes', () => {
  const testUser = createTestUser({
    email: 'billing@example.com',
    subscription: 'free',
  });

  const testUserWithSubscription = {
    ...testUser,
    subscription: 'pro',
    stripeCustomerId: 'cus_test123',
    stripeSubscriptionId: 'sub_test123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(storage.getUser).mockResolvedValue(testUser);
    vi.mocked(audit.logAudit).mockResolvedValue(undefined);
    vi.mocked(audit.getAuditContext).mockReturnValue({
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    });
  });

  describe('POST /api/billing/checkout', () => {
    it('should create checkout session for valid plan upgrade', async () => {
      vi.mocked(stripe.getPlanConfig).mockReturnValue({
        name: 'Pro',
        monthlyPrice: 29,
        priceId: 'price_pro_monthly',
        limits: { forms: 100, submissions: 10000 },
      });

      vi.mocked(stripe.createCheckoutSession).mockResolvedValue({
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
        customer: 'cus_new123',
      } as never);

      vi.mocked(storage.updateUser).mockResolvedValue(undefined);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/checkout',
        testUser.id,
        testUser.email,
        { body: { plan: 'pro' } }
      );

      const response = await checkoutPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        checkoutUrl: 'https://checkout.stripe.com/test',
        sessionId: 'cs_test123',
      });

      expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          user: testUser,
          planName: 'pro',
        })
      );
    });

    it('should reject invalid plan', async () => {
      vi.mocked(stripe.getPlanConfig).mockReturnValue(null as never);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/checkout',
        testUser.id,
        testUser.email,
        { body: { plan: 'invalid_plan' } }
      );

      const response = await checkoutPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid plan');
    });

    it('should reject if already on same plan', async () => {
      vi.mocked(storage.getUser).mockResolvedValue({
        ...testUser,
        subscription: 'pro',
      });

      vi.mocked(stripe.getPlanConfig).mockReturnValue({
        name: 'Pro',
        monthlyPrice: 29,
        priceId: 'price_pro_monthly',
        limits: { forms: 100, submissions: 10000 },
      });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/checkout',
        testUser.id,
        testUser.email,
        { body: { plan: 'pro' } }
      );

      const response = await checkoutPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('already subscribed');
    });

    it('should reject if user not found', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/checkout',
        testUser.id,
        testUser.email,
        { body: { plan: 'pro' } }
      );

      const response = await checkoutPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.error).toContain('User not found');
    });

    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('POST', '/api/billing/checkout', {
        body: { plan: 'pro' },
      });

      const response = await checkoutPOST(req);

      expect(response.status).toBe(401);
    });

    it('should log audit event on checkout started', async () => {
      vi.mocked(stripe.getPlanConfig).mockReturnValue({
        name: 'Pro',
        monthlyPrice: 29,
        priceId: 'price_pro_monthly',
        limits: { forms: 100, submissions: 10000 },
      });

      vi.mocked(stripe.createCheckoutSession).mockResolvedValue({
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/test',
        customer: 'cus_new123',
      } as never);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/checkout',
        testUser.id,
        testUser.email,
        { body: { plan: 'pro' } }
      );

      await checkoutPOST(req);

      expect(audit.logAudit).toHaveBeenCalledWith(
        testUser.id,
        audit.AuditEvents.BILLING_CHECKOUT_STARTED,
        expect.objectContaining({ plan: 'pro', sessionId: 'cs_test123' }),
        expect.any(Object)
      );
    });
  });

  describe('GET /api/billing/subscription', () => {
    it('should return subscription status for free user', async () => {
      vi.mocked(stripe.getPlanConfig).mockReturnValue({
        name: 'Free',
        monthlyPrice: 0,
        priceId: null,
        limits: { forms: 3, submissions: 100 },
      });

      vi.mocked(stripe.getPlanLimits).mockReturnValue({
        forms: 3,
        submissions: 100,
      });

      const req = createAuthenticatedRequest(
        'GET',
        '/api/billing/subscription',
        testUser.id,
        testUser.email
      );

      const response = await subscriptionGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        subscription: {
          plan: 'free',
          planName: 'Free',
          monthlyPrice: 0,
          status: 'active',
          limits: { forms: 3, submissions: 100 },
        },
      });
    });

    it('should return subscription details for paid user', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(testUserWithSubscription);

      vi.mocked(stripe.getPlanConfig).mockReturnValue({
        name: 'Pro',
        monthlyPrice: 29,
        priceId: 'price_pro_monthly',
        limits: { forms: 100, submissions: 10000 },
      });

      vi.mocked(stripe.getPlanLimits).mockReturnValue({
        forms: 100,
        submissions: 10000,
      });

      vi.mocked(stripe.getSubscription).mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      } as never);

      vi.mocked(stripe.formatSubscriptionData).mockReturnValue({
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
      });

      const req = createAuthenticatedRequest(
        'GET',
        '/api/billing/subscription',
        testUserWithSubscription.id,
        testUserWithSubscription.email
      );

      const response = await subscriptionGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data.subscription.plan).toBe('pro');
      expect(data.subscription.status).toBe('active');
    });

    it('should reject if user not found', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null);

      const req = createAuthenticatedRequest(
        'GET',
        '/api/billing/subscription',
        testUser.id,
        testUser.email
      );

      const response = await subscriptionGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.error).toContain('User not found');
    });

    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('GET', '/api/billing/subscription');

      const response = await subscriptionGET(req);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/billing/cancel', () => {
    it('should cancel subscription successfully', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(testUserWithSubscription);

      vi.mocked(stripe.cancelSubscription).mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      } as never);

      vi.mocked(stripe.formatSubscriptionData).mockReturnValue({
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
        cancelAtPeriodEnd: true,
      });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/cancel',
        testUserWithSubscription.id,
        testUserWithSubscription.email
      );

      const response = await cancelPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        message: expect.stringContaining('canceled at the end'),
      });

      expect(stripe.cancelSubscription).toHaveBeenCalledWith('sub_test123', false);
    });

    it('should reject if no active subscription', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(testUser); // No stripeSubscriptionId

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/cancel',
        testUser.id,
        testUser.email
      );

      const response = await cancelPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('No active subscription');
    });

    it('should reject if user not found', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/cancel',
        testUser.id,
        testUser.email
      );

      const response = await cancelPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.error).toContain('User not found');
    });

    it('should log audit event on subscription canceled', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(testUserWithSubscription);

      vi.mocked(stripe.cancelSubscription).mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: true,
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      } as never);

      vi.mocked(stripe.formatSubscriptionData).mockReturnValue({
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 86400 * 30 * 1000).toISOString(),
        cancelAtPeriodEnd: true,
      });

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/cancel',
        testUserWithSubscription.id,
        testUserWithSubscription.email
      );

      await cancelPOST(req);

      expect(audit.logAudit).toHaveBeenCalledWith(
        testUserWithSubscription.id,
        audit.AuditEvents.SUBSCRIPTION_CANCELED,
        expect.objectContaining({ subscriptionId: 'sub_test123' }),
        expect.any(Object)
      );
    });

    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('POST', '/api/billing/cancel');

      const response = await cancelPOST(req);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/billing/portal', () => {
    it('should create portal session successfully', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(testUserWithSubscription);

      vi.mocked(stripe.createPortalSession).mockResolvedValue({
        url: 'https://billing.stripe.com/portal/test',
      } as never);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/portal',
        testUserWithSubscription.id,
        testUserWithSubscription.email
      );

      const response = await portalPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        portalUrl: 'https://billing.stripe.com/portal/test',
      });
    });

    it('should reject if no customer ID', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(testUser); // No stripeCustomerId

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/portal',
        testUser.id,
        testUser.email
      );

      const response = await portalPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('No active subscription');
    });

    it('should reject if user not found', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/portal',
        testUser.id,
        testUser.email
      );

      const response = await portalPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.error).toContain('User not found');
    });

    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('POST', '/api/billing/portal');

      const response = await portalPOST(req);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/billing/reactivate', () => {
    it('should reactivate subscription successfully', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(testUserWithSubscription);

      vi.mocked(stripe.reactivateSubscription).mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: false,
      } as never);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/reactivate',
        testUserWithSubscription.id,
        testUserWithSubscription.email
      );

      const response = await reactivatePOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        message: expect.stringContaining('reactivated'),
      });

      expect(stripe.reactivateSubscription).toHaveBeenCalledWith('sub_test123');
    });

    it('should reject if no subscription to reactivate', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(testUser); // No stripeSubscriptionId

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/reactivate',
        testUser.id,
        testUser.email
      );

      const response = await reactivatePOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(data.error).toContain('No subscription');
    });

    it('should reject if user not found', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(null);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/reactivate',
        testUser.id,
        testUser.email
      );

      const response = await reactivatePOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(data.error).toContain('User not found');
    });

    it('should log audit event on subscription reactivated', async () => {
      vi.mocked(storage.getUser).mockResolvedValue(testUserWithSubscription);

      vi.mocked(stripe.reactivateSubscription).mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: false,
      } as never);

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/reactivate',
        testUserWithSubscription.id,
        testUserWithSubscription.email
      );

      await reactivatePOST(req);

      expect(audit.logAudit).toHaveBeenCalledWith(
        testUserWithSubscription.id,
        audit.AuditEvents.SUBSCRIPTION_REACTIVATED,
        expect.objectContaining({ subscriptionId: 'sub_test123' }),
        expect.any(Object)
      );
    });

    it('should reject unauthenticated requests', async () => {
      const req = createMockRequest('POST', '/api/billing/reactivate');

      const response = await reactivatePOST(req);

      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle Stripe API errors gracefully', async () => {
      vi.mocked(stripe.getPlanConfig).mockReturnValue({
        name: 'Pro',
        monthlyPrice: 29,
        priceId: 'price_pro_monthly',
        limits: { forms: 100, submissions: 10000 },
      });

      vi.mocked(stripe.createCheckoutSession).mockRejectedValue(
        new Error('Stripe API error')
      );

      const req = createAuthenticatedRequest(
        'POST',
        '/api/billing/checkout',
        testUser.id,
        testUser.email,
        { body: { plan: 'pro' } }
      );

      const response = await checkoutPOST(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(storage.getUser).mockRejectedValue(new Error('Storage error'));

      const req = createAuthenticatedRequest(
        'GET',
        '/api/billing/subscription',
        testUser.id,
        testUser.email
      );

      const response = await subscriptionGET(req);
      const data = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
