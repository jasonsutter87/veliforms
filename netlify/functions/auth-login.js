import { verifyPassword, createToken } from './lib/auth.js';
import { getUser } from './lib/storage.js';

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

    // Get user
    const user = await getUser(email);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers
      });
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers
      });
    }

    // Create JWT token
    const token = createToken({ id: user.id, email: user.email });

    return new Response(JSON.stringify({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        subscription: user.subscription
      }
    }), {
      status: 200,
      headers
    });
  } catch (err) {
    console.error('Login error:', err);
    return new Response(JSON.stringify({ error: 'Login failed' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/auth/login'
};
