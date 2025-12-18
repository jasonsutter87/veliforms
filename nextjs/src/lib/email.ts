/**
 * VeilForms - Email Service
 * Send transactional emails via Resend
 */

// Note: Install resend with `npm install resend` when ready to use
// import { Resend } from 'resend';

import { apiLogger } from "./logger";

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@veilforms.com";
const FROM_NAME = "VeilForms";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";

interface EmailResult {
  provider: string;
  id: string;
}

/**
 * Send email verification
 */
export async function sendEmailVerification(
  email: string,
  verifyUrl: string
): Promise<EmailResult> {
  // TODO: Implement with Resend when API key is configured
  apiLogger.debug({ to: email, type: 'verification', verifyUrl }, "Would send verification email (dev mode)");
  return { provider: "dev", id: "dev-" + Date.now() };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<EmailResult> {
  // TODO: Implement with Resend when API key is configured
  apiLogger.debug({ to: email, type: 'password-reset', resetUrl }, "Would send password reset email (dev mode)");
  return { provider: "dev", id: "dev-" + Date.now() };
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(
  email: string
): Promise<EmailResult | null> {
  // TODO: Implement with Resend when API key is configured
  apiLogger.debug({ to: email, type: 'welcome' }, "Would send welcome email (dev mode)");
  return { provider: "dev", id: "dev-" + Date.now() };
}

export { FROM_EMAIL, FROM_NAME, BASE_URL };
