/**
 * VeilForms - Single Team Endpoint
 * GET /api/teams/[id] - Get team details
 * PUT /api/teams/[id] - Update team
 * DELETE /api/teams/[id] - Delete team
 */

import { NextRequest, NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { getTeam, updateTeam, deleteTeam, hasTeamPermission } from "@/lib/teams";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { sanitizeString } from "@/lib/validation";
import { errorResponse, ErrorCodes } from "@/lib/errors";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = authRoute<RouteParams>(async (req, { user }, routeCtx) => {
  try {
    const { id: teamId } = await routeCtx!.params;

    // Get team
    const team = await getTeam(teamId);
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Verify user is a member
    const isMember = await hasTeamPermission(teamId, user.userId, 'forms:view');
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ team });
  } catch (err) {
    console.error("Get team error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, { rateLimit: { keyPrefix: "teams-api", maxRequests: 60 } });

export const PUT = authRoute<RouteParams>(async (req, { user }, routeCtx) => {
  try {
    const { id: teamId } = await routeCtx!.params;
    const body = await req.json();

    // Get team
    const team = await getTeam(teamId);
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Verify user has permission to manage team
    const canManage = await hasTeamPermission(teamId, user.userId, 'team:manage');
    if (!canManage) {
      return NextResponse.json(
        { error: "Only team owners can update team settings" },
        { status: 403 }
      );
    }

    // Sanitize updates
    const updates: {
      name?: string;
      settings?: typeof team.settings;
    } = {};

    if (body.name) {
      const sanitizedName = sanitizeString(body.name, { maxLength: 100 });
      if (sanitizedName) {
        updates.name = sanitizedName;
      }
    }

    if (body.settings) {
      updates.settings = {
        allowMemberInvites: body.settings.allowMemberInvites ?? team.settings.allowMemberInvites,
        defaultFormAccess: body.settings.defaultFormAccess ?? team.settings.defaultFormAccess,
      };
    }

    // Update team
    const updated = await updateTeam(teamId, updates);

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      user.userId,
      AuditEvents.TEAM_UPDATED,
      {
        teamId,
        updates: Object.keys(updates),
      },
      auditCtx
    );

    return NextResponse.json({ team: updated });
  } catch (err) {
    console.error("Update team error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, {
  rateLimit: { keyPrefix: "teams-api", maxRequests: 30 },
  csrf: true
});

export const DELETE = authRoute<RouteParams>(async (req, { user }, routeCtx) => {
  try {
    const { id: teamId } = await routeCtx!.params;

    // Get team
    const team = await getTeam(teamId);
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Only owner can delete team
    if (team.ownerId !== user.userId) {
      return NextResponse.json(
        { error: "Only team owner can delete the team" },
        { status: 403 }
      );
    }

    // Delete team
    await deleteTeam(teamId);

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      user.userId,
      AuditEvents.TEAM_DELETED,
      {
        teamId,
        teamName: team.name,
      },
      auditCtx
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete team error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, {
  rateLimit: { keyPrefix: "teams-api", maxRequests: 10 },
  csrf: true
});
