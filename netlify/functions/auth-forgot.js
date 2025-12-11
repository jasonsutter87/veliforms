import crypto from 'crypto';
import { getUser, createPasswordResetToken } from './lib/storage.js';
import { sendPasswordResetEmail } from './lib/email.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default async function handler(req, context) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers
      });
    }

    // Always return success to prevent email enumeration
    const successResponse = () => new Response(JSON.stringify({
      success: true,
      message: 'If an account with that email exists, we sent a password reset link.'
    }), {
      status: 200,
      headers
    });

    // Check if user exists (silently)
    const user = await getUser(email);
    if (!user) {
      // Return success even if user doesn't exist (security)
      return successResponse();
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');

    // Store token
    await createPasswordResetToken(email, token);

    // Build reset URL
    const baseUrl = process.env.URL || 'https://veilforms.com';
    const resetUrl = `${baseUrl}/reset/?token=${token}`;

    // Send email
    try {
      await sendPasswordResetEmail(email, resetUrl);
      console.log(`Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Still return success to prevent enumeration
    }

    return successResponse();
  } catch (err) {
    console.error('Forgot password error:', err);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/auth/forgot'
};
