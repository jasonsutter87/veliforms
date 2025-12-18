import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@netlify/blobs';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verify cron authorization
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    emailVerificationTokens: 0,
    passwordResetTokens: 0,
    revokedTokens: 0,
    errors: [] as string[],
  };

  // Cleanup email verification tokens
  try {
    const store = getStore({ name: 'vf-email-verification-tokens', consistency: 'strong' });
    const { blobs } = await store.list();
    const now = Date.now();

    for (const blob of blobs) {
      try {
        const token = await store.get(blob.key, { type: 'json' }) as { expiresAt: string } | null;
        if (token && new Date(token.expiresAt).getTime() < now) {
          await store.delete(blob.key);
          results.emailVerificationTokens++;
        }
      } catch (err) {
        results.errors.push(`Email token ${blob.key}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Email verification store: ${err}`);
  }

  // Cleanup password reset tokens
  try {
    const store = getStore({ name: 'vf-password-reset-tokens', consistency: 'strong' });
    const { blobs } = await store.list();
    const now = Date.now();

    for (const blob of blobs) {
      try {
        const token = await store.get(blob.key, { type: 'json' }) as { expiresAt: string } | null;
        if (token && new Date(token.expiresAt).getTime() < now) {
          await store.delete(blob.key);
          results.passwordResetTokens++;
        }
      } catch (err) {
        results.errors.push(`Reset token ${blob.key}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Password reset store: ${err}`);
  }

  // Cleanup revoked JWT tokens
  try {
    const store = getStore({ name: 'vf-token-blocklist', consistency: 'strong' });
    const { blobs } = await store.list();
    const now = Date.now();

    for (const blob of blobs) {
      try {
        const token = await store.get(blob.key, { type: 'json' }) as { expiresAt: number } | null;
        if (token && token.expiresAt < now) {
          await store.delete(blob.key);
          results.revokedTokens++;
        }
      } catch (err) {
        results.errors.push(`Blocklist ${blob.key}: ${err}`);
      }
    }
  } catch (err) {
    results.errors.push(`Token blocklist store: ${err}`);
  }

  return NextResponse.json({
    success: true,
    cleaned: {
      emailVerificationTokens: results.emailVerificationTokens,
      passwordResetTokens: results.passwordResetTokens,
      revokedTokens: results.revokedTokens,
    },
    errors: results.errors.length > 0 ? results.errors : undefined,
  });
}
