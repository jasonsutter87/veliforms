/**
 * VeilForms - Teams Management Endpoint
 * GET /api/teams - List user's teams
 * POST /api/teams - Create new team
 */

import { NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { createTeam, getUserTeams } from "@/lib/teams";
import { getUserById } from "@/lib/storage";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { sanitizeString } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";

export const GET = authRoute(async (req, { user }) => {
  try {
    const teams = await getUserTeams(user.userId);

    return NextResponse.json({
      teams,
      total: teams.length,
    });
  } catch (err) {
    console.error("List teams error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, { rateLimit: { keyPrefix: "teams-api", maxRequests: 30 } });

export const POST = authRoute(async (req, { user }) => {
  try {
    const body = await req.json();
    const { name, plan = 'team' } = body;

    // Sanitize team name
    const sanitizedName = sanitizeString(name, { maxLength: 100 });
    if (!sanitizedName) {
      return NextResponse.json(
        { error: "Team name is required" },
        { status: 400 }
      );
    }

    // Validate plan
    if (plan !== 'team' && plan !== 'enterprise') {
      return NextResponse.json(
        { error: "Invalid plan. Must be 'team' or 'enterprise'" },
        { status: 400 }
      );
    }

    // Check if user's subscription allows team creation
    const userRecord = await getUserById(user.userId);
    const subscription = userRecord?.subscription || "free";

    // Only pro, business, and enterprise users can create teams
    if (!['pro', 'business', 'enterprise'].includes(subscription)) {
      return NextResponse.json(
        {
          error: "Team feature requires Pro plan or higher",
          subscription,
          message: "Upgrade to Pro to create teams and collaborate with others",
        },
        { status: 402 }
      );
    }

    // Create team
    const team = await createTeam(sanitizedName, user.userId, plan);

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      user.userId,
      AuditEvents.TEAM_CREATED,
      {
        teamId: team.id,
        teamName: team.name,
        plan: team.plan,
      },
      auditCtx
    );

    return NextResponse.json(
      { team },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create team error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, {
  rateLimit: { keyPrefix: "teams-api", maxRequests: 10 },
  csrf: true
});
