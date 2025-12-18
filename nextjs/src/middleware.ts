import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only apply to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  // Add CORS headers to response
  const response = NextResponse.next();
  const corsHeaders = getCorsHeaders(request);
  const securityHeaders = getSecurityHeaders();

  // Apply CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Get security headers for all responses
 */
function getSecurityHeaders(): Record<string, string> {
  const isProduction = process.env.NODE_ENV === 'production';

  const headers: Record<string, string> = {
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Enable XSS protection in legacy browsers
    'X-XSS-Protection': '1; mode=block',

    // Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Restrict browser features
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

    // Content Security Policy - safe defaults
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  };

  // Add HSTS only in production
  if (isProduction) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }

  return headers;
}

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  const isProduction = process.env.NODE_ENV === 'production';

  // Get allowed origins from environment
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;

  // In production, NEVER default to wildcard
  if (isProduction && !allowedOriginsEnv) {
    return {
      'Access-Control-Allow-Origin': 'null',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Idempotency-Key',
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Max-Age': '86400',
    };
  }

  const allowedOrigins = allowedOriginsEnv?.split(',') || ['*'];

  // Validate origin against whitelist
  let allowedOrigin = 'null';
  let allowCredentials = 'false';

  if (origin && allowedOrigins.includes(origin)) {
    allowedOrigin = origin;
    allowCredentials = 'true';
  } else if (allowedOrigins.includes('*') && !isProduction) {
    // Only allow wildcard in non-production
    allowedOrigin = origin || '*';
    allowCredentials = origin ? 'true' : 'false';
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Idempotency-Key',
    'Access-Control-Allow-Credentials': allowCredentials,
    'Access-Control-Max-Age': '86400',
  };
}

export const config = {
  matcher: '/api/:path*',
};
