import { authenticateRequest } from './lib/auth.js';
import { createForm } from './lib/storage.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Generate RSA key pair for form encryption
async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return { publicKey, privateKey };
}

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
    // Authenticate
    const auth = authenticateRequest(req);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers
      });
    }

    const body = await req.json();
    const { name, settings } = body;

    if (!name) {
      return new Response(JSON.stringify({ error: 'Form name is required' }), {
        status: 400,
        headers
      });
    }

    // Generate encryption keys
    const { publicKey, privateKey } = await generateKeyPair();

    // Create form
    const form = await createForm(auth.user.id, {
      name,
      publicKey,
      settings
    });

    // Return form with private key (only time it's shown)
    return new Response(JSON.stringify({
      form: {
        id: form.id,
        name: form.name,
        createdAt: form.createdAt,
        publicKey: form.publicKey,
        privateKey, // Include private key - user must save this!
        settings: form.settings
      },
      warning: 'Save your private key immediately! This is the only time it will be shown. We cannot recover it.'
    }), {
      status: 201,
      headers
    });
  } catch (err) {
    console.error('Forms create error:', err);
    return new Response(JSON.stringify({ error: 'Failed to create form' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/forms/create'
};
