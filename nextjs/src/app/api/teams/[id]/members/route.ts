/**
 * VeilForms - Team Members Endpoint
 * GET /api/teams/[id]/members - List team members
 * POST /api/teams/[id]/members - Invite new member
 */

import { NextResponse } from "next/server";
import { authRoute } from "@/lib/route-handler";
import {
  getTeam,
  getTeamMembers,
  inviteTeamMember,
  hasTeamPermission,
  getTeamInvites,
} from "@/lib/teams";
import { getUserById } from "@/lib/storage";
import { logAudit, AuditEvents, getAuditContext } from "@/lib/audit";
import { errorResponse, ErrorCodes } from "@/lib/errors";
import { sendEmail } from "@/lib/email";

export const GET = authRoute(async (req, { user, params }) => {
  try {
    const teamId = params.id as string;

    // Verify user is a member
    const isMember = await hasTeamPermission(teamId, user.userId, 'forms:view');
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Get members and invites
    const [members, invites] = await Promise.all([
      getTeamMembers(teamId),
      getTeamInvites(teamId),
    ]);

    // Enrich member data with user info
    const enrichedMembers = await Promise.all(
      members.map(async (member) => {
        const userData = await getUserById(member.userId);
        return {
          ...member,
          userName: userData?.name || null,
          userEmail: userData?.email || member.email,
        };
      })
    );

    return NextResponse.json({
      members: enrichedMembers,
      invites,
    });
  } catch (err) {
    console.error("Get team members error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, { rateLimit: { keyPrefix: "teams-api", maxRequests: 60 } });

export const POST = authRoute(async (req, { user, params }) => {
  try {
    const teamId = params.id as string;
    const body = await req.json();
    const { email, role = 'viewer' } = body;

    // Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

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
    const canInvite = await hasTeamPermission(teamId, user.userId, 'members:invite');
    if (!canInvite) {
      return NextResponse.json(
        { error: "You don't have permission to invite members" },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMembers = await getTeamMembers(teamId);
    const alreadyMember = existingMembers.some(
      (m) => m.email.toLowerCase() === email.toLowerCase()
    );
    if (alreadyMember) {
      return NextResponse.json(
        { error: "User is already a team member" },
        { status: 400 }
      );
    }

    // Check if there's already a pending invite
    const pendingInvites = await getTeamInvites(teamId);
    const existingInvite = pendingInvites.some(
      (inv) => inv.email.toLowerCase() === email.toLowerCase()
    );
    if (existingInvite) {
      return NextResponse.json(
        { error: "An invite has already been sent to this email" },
        { status: 400 }
      );
    }

    // Create invite
    const invite = await inviteTeamMember(teamId, email, role, user.userId);

    // Send invite email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";
    const inviteUrl = `${baseUrl}/team/accept-invite?token=${invite.token}`;

    const inviter = await getUserById(user.userId);
    const inviterName = inviter?.name || inviter?.email || "A team member";

    try {
      await sendEmail({
        to: email,
        subject: `You've been invited to join ${team.name} on VeilForms`,
        text: `${inviterName} has invited you to join the team "${team.name}" on VeilForms as a ${role}.\n\nClick the link below to accept the invitation:\n${inviteUrl}\n\nThis invitation will expire in 7 days.`,
        html: `
          <p>${inviterName} has invited you to join the team <strong>${team.name}</strong> on VeilForms as a <strong>${role}</strong>.</p>
          <p><a href="${inviteUrl}">Click here to accept the invitation</a></p>
          <p>This invitation will expire in 7 days.</p>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send invite email:", emailErr);
      // Continue anyway - the invite is created
    }

    // Log audit event
    const auditCtx = getAuditContext(req);
    await logAudit(
      user.userId,
      AuditEvents.TEAM_MEMBER_INVITED,
      {
        teamId,
        inviteEmail: email,
        role,
      },
      auditCtx
    );

    return NextResponse.json(
      { invite: { ...invite, token: undefined } }, // Don't return token
      { status: 201 }
    );
  } catch (err) {
    console.error("Invite member error:", err);
    return errorResponse(ErrorCodes.SERVER_ERROR);
  }
}, {
  rateLimit: { keyPrefix: "teams-api", maxRequests: 20 },
  csrf: true
});
