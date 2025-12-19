/**
 * VeilForms - Retention Policy Enforcement Cron Job
 * GET /api/cron/enforce-retention
 *
 * This endpoint should be called periodically (e.g., daily) by a cron service
 * like Netlify Scheduled Functions, Vercel Cron, or external cron job service.
 *
 * To secure this endpoint:
 * 1. Use Netlify/Vercel's built-in scheduled functions (recommended)
 * 2. OR add an Authorization header with a secret token
 */

import { NextRequest, NextResponse } from "next/server";
import { enforceAllRetentionPolicies } from "@/lib/gdpr";

// Secret token for cron job authentication
// Set this in your environment variables: CRON_SECRET
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  // Verify cron secret if configured
  if (CRON_SECRET) {
    const authHeader = req.headers.get("authorization");
    const providedSecret = authHeader?.replace("Bearer ", "");

    if (providedSecret !== CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  } else {
    console.warn(
      "CRON_SECRET not set - retention enforcement endpoint is not secured!"
    );
  }

  try {
    console.log("Starting retention policy enforcement...");
    const startTime = Date.now();

    const result = await enforceAllRetentionPolicies();

    const duration = Date.now() - startTime;

    console.log(
      `Retention enforcement completed in ${duration}ms:`,
      result
    );

    return NextResponse.json({
      success: true,
      ...result,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Retention enforcement error:", error);

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility with different cron services
export async function POST(req: NextRequest) {
  return GET(req);
}
