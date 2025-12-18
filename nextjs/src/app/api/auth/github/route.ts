/**
 * VeilForms - GitHub OAuth Endpoint
 * GET /api/auth/github - Redirect to GitHub OAuth
 */

import { NextResponse } from "next/server";

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com"}/api/auth/callback/github`;

export async function GET() {
  if (!GITHUB_CLIENT_ID) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured" },
      { status: 500 }
    );
  }

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Build GitHub authorization URL
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: "user:email",
    state: state,
  });

  const authUrl = `https://github.com/login/oauth/authorize?${params}`;

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
