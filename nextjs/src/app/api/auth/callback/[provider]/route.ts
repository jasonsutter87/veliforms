/**
 * VeilForms - OAuth Callback Endpoint
 * GET /api/auth/callback/[provider] - Handle OAuth callback for GitHub/Google
 */

import { NextRequest, NextResponse } from "next/server";
import { createToken } from "@/lib/auth";
import { getUser, createOAuthUser, updateUser } from "@/lib/storage";

// OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com"}/api/auth/callback/google`;

interface OAuthUserInfo {
  email: string;
  providerId: string;
  name: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

function redirectWithError(message: string): NextResponse {
  const encodedMessage = encodeURIComponent(message);
  return NextResponse.redirect(
    new URL(`/login/?error=${encodedMessage}`, process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com")
  );
}

async function handleGitHub(code: string): Promise<OAuthUserInfo> {
  // Exchange code for access token
  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: code,
      }),
    }
  );

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }

  const accessToken = tokenData.access_token;

  // Get user info
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const userData = await userResponse.json();

  // Get user email (may be private)
  let email = userData.email;

  if (!email) {
    const emailsResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const emails: GitHubEmail[] = await emailsResponse.json();
    const primaryEmail = emails.find((e) => e.primary && e.verified);
    email = primaryEmail?.email;
  }

  return {
    email,
    providerId: String(userData.id),
    name: userData.name || userData.login,
  };
}

async function handleGoogle(code: string): Promise<OAuthUserInfo> {
  // Exchange code for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: GOOGLE_REDIRECT_URI,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }

  const accessToken = tokenData.access_token;

  // Get user info
  const userResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const userData = await userResponse.json();

  return {
    email: userData.email,
    providerId: userData.id,
    name: userData.name,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    return redirectWithError(`OAuth error: ${error}`);
  }

  if (!code) {
    return redirectWithError("No authorization code received");
  }

  // Verify state (CSRF protection)
  const storedState = req.cookies.get("oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return redirectWithError("Invalid state parameter");
  }

  try {
    let userInfo: OAuthUserInfo;

    if (provider === "github") {
      userInfo = await handleGitHub(code);
    } else if (provider === "google") {
      userInfo = await handleGoogle(code);
    } else {
      return redirectWithError("Unknown OAuth provider");
    }

    if (!userInfo || !userInfo.email) {
      return redirectWithError("Could not retrieve email from provider");
    }

    // Get or create user
    let user = await getUser(userInfo.email);

    if (!user) {
      // Create new OAuth user
      user = await createOAuthUser(
        userInfo.email,
        provider,
        userInfo.providerId,
        userInfo.name
      );
    } else {
      // Update existing user with OAuth provider info if not already set
      if (!user.oauthProvider) {
        await updateUser(userInfo.email, {
          oauthProvider: provider,
          oauthProviderId: userInfo.providerId,
          emailVerified: true,
          emailVerifiedAt: new Date().toISOString(),
        });
      }
    }

    // Create JWT token
    const token = createToken({ userId: user.id, email: user.email });

    // Clear the state cookie and redirect with token
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
    const response = NextResponse.redirect(
      new URL(`/dashboard/?auth_token=${token}`, baseUrl)
    );

    response.cookies.set("oauth_state", "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0,
    });

    return response;
  } catch (err) {
    console.error("OAuth callback error:", err);
    return redirectWithError("Authentication failed");
  }
}
