import { authenticateRequest } from './lib/auth.js';
import { getUserForms } from './lib/storage.js';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default async function handler(req, context) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== 'GET') {
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

    // Get user's forms
    const forms = await getUserForms(auth.user.id);

    // Remove private keys from response
    const sanitizedForms = forms.map(form => ({
      id: form.id,
      name: form.name,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      submissionCount: form.submissionCount,
      publicKey: form.publicKey,
      settings: form.settings
    }));

    return new Response(JSON.stringify({
      forms: sanitizedForms,
      total: sanitizedForms.length
    }), {
      status: 200,
      headers
    });
  } catch (err) {
    console.error('Forms list error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch forms' }), {
      status: 500,
      headers
    });
  }
}

export const config = {
  path: '/api/forms'
};
