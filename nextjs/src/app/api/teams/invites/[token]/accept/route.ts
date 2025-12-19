/**
 * VeilForms - Team Invite Acceptance Endpoint
 * POST /api/teams/invites/[token]/accept - Accept team invitation
 */

import { NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import { getInviteByToken, acceptInvite, getTeam } from "@/lib/teams";
import { getUserById } from "@/lib/storage";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { errorResponse, ErrorCodes } from "@/lib/errors";

export const POST = authRoute(async (req, { user, params }) => {
  try {
    const token = params.token as string;

    // Get invite
    const invite = await getInviteByToken(token);
    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found or expired" },
        { status: 404 }
      );
    }

    // Get user data
    const userData = await getUserById(user.userId);
    if (!userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify email matches
    if (userData.email.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: "This invitation was sent to a different email address",
          inviteEmail: invite.email,
          userEmail: userData.email,
        },
        { status: 400 }
      );
    }

    // Accept invite
    const member = await acceptInvite(invite.id, user.userId, userData.email);

    // Get team info
    const team = await getTeam(invite.teamId);

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      user.userId,
      AuditEvents.TEAM_MEMBER_JOINED,
      {
        teamId: invite.teamId,
        role: invite.role,
      },
      auditCtx
    );

    return NextResponse.json({
      success: true,
      member,
      team,
    });
  } catch (err) {
    console.error("Accept invite error:", err);

    if (err instanceof Error && err.message === "Email mismatch") {
      return NextResponse.json(
        { error: "Email address does not match the invitation" },
        { status: 400 }
      );
    }

    if (err instanceof Error && err.message === "Invite expired") {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, {
  rateLimit: { keyPrefix: "teams-api", maxRequests: 20 },
  csrf: true
});
