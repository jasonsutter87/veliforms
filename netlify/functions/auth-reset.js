import { hashPassword } from './lib/auth.js';
import { getPasswordResetToken, deletePasswordResetToken, updateUser } from './lib/storage.js';

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
    const { token, password } = await req.json();

    if (!token || !password) {
      return new Response(JSON.stringify({ error: 'Token and password are required' }), {
        status: 400,
        headers
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers
      });
    }

    // Validate token
    const tokenData = await getPasswordResetToken(token);
    if (!tokenData) {
      return new Response(JSON.stringify({ error: 'Invalid or expired reset link' }), {
        status: 400,
        headers
      });
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user's password
    const updated = await updateUser(tokenData.email, { passwordHash });
    if (!updated) {
      return new Response(JSON.stringify({ error: 'Failed to update password' }), {
        status: 500,
        headers
      });
    }

    // Delete the used token (one-time use)
    await deletePasswordResetToken(token);

    console.log(`Password reset successful for ${tokenData.email}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Password has been reset successfully'
    }), {
      status: 200,
      headers
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return new Response(JSON.stringify({ error: 'An error occurred' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/auth/reset'
};
