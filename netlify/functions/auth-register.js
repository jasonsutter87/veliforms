import { hashPassword, createToken } from './lib/auth.js';
import { createUser, getUser } from './lib/storage.js';
import { sendWelcomeEmail } from './lib/email.js';

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
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
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

    // Check if user exists
    const existing = await getUser(email);
    if (existing) {
      return new Response(JSON.stringify({ error: 'Email already registered' }), {
        status: 409,
        headers
      });
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash);

    // Create JWT token
    const token = createToken({ id: user.id, email: user.email });

    // Send welcome email (don't await - fire and forget)
    sendWelcomeEmail(email).catch(err => {
      console.error('Welcome email failed:', err);
    });

    return new Response(JSON.stringify({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription
      }
    }), {
      status: 201,
      headers
    });
  } catch (err) {
    console.error('Register error:', err);
    return new Response(JSON.stringify({ error: 'Registration failed' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/auth/register'
};
