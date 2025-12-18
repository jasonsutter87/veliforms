/**
 * VeilForms - Google OAuth Endpoint
 * GET /api/auth/google - Redirect to Google OAuth
 */

import { NextResponse } from "next/server";

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com"}/api/auth/callback/google`;

export async function GET() {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Build Google authorization URL
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "email profile",
    state: state,
    access_type: "offline",
    prompt: "consent",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  // Store state in cookie for verification on callback
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("oauth_state", state, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
