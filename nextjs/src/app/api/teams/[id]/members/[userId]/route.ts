/**
 * VeilForms - Individual Team Member Endpoint
 * PUT /api/teams/[id]/members/[userId] - Update member role
 * DELETE /api/teams/[id]/members/[userId] - Remove member
 */

import { NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import {
  getTeam,
  getTeamMember,
  updateMemberRole,
  removeTeamMember,
  hasTeamPermission,
} from "@/lib/teams";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { errorResponse, ErrorCodes } from "@/lib/errors";

type RouteParams = { params: Promise<{ id: string; userId: string }> };

export const PUT = authRoute<RouteParams>(async (req, { user }, routeCtx) => {
  try {
    const { id: teamId, userId: targetUserId } = await routeCtx!.params;
    const body = await req.json();
    const { role } = body;

    // Validate role
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be admin, editor, or viewer" },
        { status: 400 }
      );
    }

    // Get team
    const team = await getTeam(teamId);
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Check permissions
    const canManage = await hasTeamPermission(teamId, user.userId, 'members:manage');
    if (!canManage) {
      return NextResponse.json(
        { error: "You don't have permission to manage members" },
        { status: 403 }
      );
    }

    // Get target member
    const targetMember = await getTeamMember(teamId, targetUserId);
    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Cannot change owner role
    if (targetMember.role === 'owner') {
      return NextResponse.json(
        { error: "Cannot change the role of the team owner" },
        { status: 400 }
      );
    }

    // Update role
    const updated = await updateMemberRole(teamId, targetUserId, role);

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      user.userId,
      AuditEvents.TEAM_MEMBER_ROLE_CHANGED,
      {
        teamId,
        targetUserId,
        oldRole: targetMember.role,
        newRole: role,
      },
      auditCtx
    );

    return NextResponse.json({ member: updated });
  } catch (err) {
    console.error("Update member role error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, {
  rateLimit: { keyPrefix: "teams-api", maxRequests: 30 },
  csrf: true
});

export const DELETE = authRoute<RouteParams>(async (req, { user }, routeCtx) => {
  try {
    const { id: teamId, userId: targetUserId } = await routeCtx!.params;

    // Get team
    const team = await getTeam(teamId);
    if (!team) {
      return NextResponse.json(
        { error: "Team not found" },
        { status: 404 }
      );
    }

    // Get target member
    const targetMember = await getTeamMember(teamId, targetUserId);
    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Cannot remove owner
    if (targetMember.role === 'owner') {
      return NextResponse.json(
        { error: "Cannot remove the team owner" },
        { status: 400 }
      );
    }

    // Users can remove themselves, or users with permission can remove others
    const isSelf = targetUserId === user.userId;
    const canManage = await hasTeamPermission(teamId, user.userId, 'members:manage');

    if (!isSelf && !canManage) {
      return NextResponse.json(
        { error: "You don't have permission to remove members" },
        { status: 403 }
      );
    }

    // Remove member
    await removeTeamMember(teamId, targetUserId);

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      user.userId,
      AuditEvents.TEAM_MEMBER_REMOVED,
      {
        teamId,
        targetUserId,
        isSelf,
      },
      auditCtx
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Remove member error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, {
  rateLimit: { keyPrefix: "teams-api", maxRequests: 20 },
  csrf: true
});
