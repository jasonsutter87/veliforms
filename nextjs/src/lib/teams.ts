/**
 * VeilForms - Teams Library
 * Team collaboration and organization support
 */

import { getStore } from "@netlify/blobs";
import { storageLogger } from "./logger";
import { retryStorage } from "./retry";

// Store name
const TEAMS_STORE = "vf-teams";

// Type definitions
export interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  plan: 'team' | 'enterprise';
  settings: TeamSettings;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  invitedBy: string;
  invitedAt: string;
  joinedAt: string | null;
  status: 'pending' | 'active';
}

export interface TeamSettings {
  allowMemberInvites: boolean;
  defaultFormAccess: 'private' | 'team';
}

export interface TeamInvite {
  id: string;
  teamId: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  invitedBy: string;
  token: string;
  createdAt: string;
  expiresAt: string;
}

// Get store instance
function store() {
  return getStore({ name: TEAMS_STORE, consistency: "strong" });
}

// === TEAM OPERATIONS ===

/**
 * Create a new team
 */
export async function createTeam(
  name: string,
  ownerId: string,
  plan: 'team' | 'enterprise' = 'team'
): Promise<Team> {
  const teams = store();
  const teamId = "team_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

  const team: Team = {
    id: teamId,
    name,
    ownerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    plan,
    settings: {
      allowMemberInvites: true,
      defaultFormAccess: 'team',
    },
  };

  await teams.setJSON(teamId, team);

  // Add owner as first member
  const ownerMember: TeamMember = {
    id: "member_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
    teamId,
    userId: ownerId,
    email: "", // Will be filled when we have user email
    role: 'owner',
    invitedBy: ownerId,
    invitedAt: new Date().toISOString(),
    joinedAt: new Date().toISOString(),
    status: 'active',
  };

  await teams.setJSON(`member_${teamId}_${ownerId}`, ownerMember);

  // Index: user's teams
  const userTeamsKey = `user_teams_${ownerId}`;
  let userTeams: string[] = [];
  try {
    userTeams = (await teams.get(userTeamsKey, { type: "json" })) as string[] | null || [];
  } catch {
    userTeams = [];
  }
  userTeams.push(teamId);
  await teams.setJSON(userTeamsKey, userTeams);

  // Index: team members list
  await teams.setJSON(`team_members_${teamId}`, [ownerMember.id]);

  storageLogger.debug({ teamId, ownerId }, 'Team created');
  return team;
}

/**
 * Get team by ID
 */
export async function getTeam(teamId: string): Promise<Team | null> {
  return retryStorage(async () => {
    const teams = store();
    try {
      const team = (await teams.get(teamId, { type: "json" })) as Team | null;
      storageLogger.debug({ teamId, found: !!team }, 'Team lookup');
      return team;
    } catch (error) {
      storageLogger.warn({ teamId, error }, 'Team lookup failed');
      return null;
    }
  }, 'getTeam');
}

/**
 * Get all teams for a user
 */
export async function getUserTeams(userId: string): Promise<Team[]> {
  return retryStorage(async () => {
    const teams = store();
    const userTeamsKey = `user_teams_${userId}`;

    try {
      const teamIds = (await teams.get(userTeamsKey, { type: "json" })) as string[] | null || [];
      const teamDetails = await Promise.all(
        teamIds.map(async (id) => {
          try {
            return (await teams.get(id, { type: "json" })) as Team | null;
          } catch {
            return null;
          }
        })
      );
      const validTeams = teamDetails.filter((t): t is Team => t !== null);
      storageLogger.debug({ userId, count: validTeams.length }, 'User teams lookup');
      return validTeams;
    } catch (error) {
      storageLogger.warn({ userId, error }, 'User teams lookup failed');
      return [];
    }
  }, 'getUserTeams');
}

/**
 * Update team
 */
export async function updateTeam(
  teamId: string,
  updates: Partial<Omit<Team, 'id' | 'ownerId' | 'createdAt'>>
): Promise<Team | null> {
  const teams = store();
  const team = await getTeam(teamId);
  if (!team) return null;

  const updated: Team = {
    ...team,
    ...updates,
    settings: { ...team.settings, ...(updates.settings || {}) },
    updatedAt: new Date().toISOString(),
  };

  await teams.setJSON(teamId, updated);
  storageLogger.debug({ teamId }, 'Team updated');
  return updated;
}

/**
 * Delete team
 */
export async function deleteTeam(teamId: string): Promise<boolean> {
  const teams = store();

  // Get all members to clean up their indexes
  const members = await getTeamMembers(teamId);

  // Delete team
  await teams.delete(teamId);

  // Clean up member records
  for (const member of members) {
    await teams.delete(`member_${teamId}_${member.userId}`);

    // Remove from user's teams list
    const userTeamsKey = `user_teams_${member.userId}`;
    try {
      const userTeams = (await teams.get(userTeamsKey, { type: "json" })) as string[] | null || [];
      const filtered = userTeams.filter((id) => id !== teamId);
      await teams.setJSON(userTeamsKey, filtered);
    } catch {
      // Ignore
    }
  }

  // Delete members list
  await teams.delete(`team_members_${teamId}`);

  storageLogger.debug({ teamId }, 'Team deleted');
  return true;
}

// === TEAM MEMBER OPERATIONS ===

/**
 * Get team member by user ID
 */
export async function getTeamMember(
  teamId: string,
  userId: string
): Promise<TeamMember | null> {
  return retryStorage(async () => {
    const teams = store();
    try {
      const member = (await teams.get(`member_${teamId}_${userId}`, {
        type: "json",
      })) as TeamMember | null;
      return member;
    } catch (error) {
      storageLogger.warn({ teamId, userId, error }, 'Team member lookup failed');
      return null;
    }
  }, 'getTeamMember');
}

/**
 * Get all members of a team
 */
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  return retryStorage(async () => {
    const teams = store();
    try {
      const memberIds = (await teams.get(`team_members_${teamId}`, {
        type: "json",
      })) as string[] | null || [];

      const members = await Promise.all(
        memberIds.map(async (memberId) => {
          try {
            // Member IDs in the list are just the unique ID, need to get by team+user
            // Actually we store the full member record with a composite key
            // Let's iterate through and get them properly
            const parts = memberId.split('_');
            // This is problematic - we need to rethink the indexing
            // For now, let's store members by their ID
            return (await teams.get(memberId, { type: "json" })) as TeamMember | null;
          } catch {
            return null;
          }
        })
      );

      return members.filter((m): m is TeamMember => m !== null);
    } catch (error) {
      storageLogger.warn({ teamId, error }, 'Team members lookup failed');
      return [];
    }
  }, 'getTeamMembers');
}

/**
 * Invite a member to a team
 */
export async function inviteTeamMember(
  teamId: string,
  email: string,
  role: 'admin' | 'editor' | 'viewer',
  invitedBy: string
): Promise<TeamInvite> {
  const teams = store();
  const inviteId = "invite_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  const token = generateInviteToken();

  const invite: TeamInvite = {
    id: inviteId,
    teamId,
    email: email.toLowerCase(),
    role,
    invitedBy,
    token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  };

  await teams.setJSON(`invite_${inviteId}`, invite);
  await teams.setJSON(`invite_token_${token}`, { inviteId });

  // Add to team's pending invites list
  const invitesKey = `team_invites_${teamId}`;
  let invites: string[] = [];
  try {
    invites = (await teams.get(invitesKey, { type: "json" })) as string[] | null || [];
  } catch {
    invites = [];
  }
  invites.push(inviteId);
  await teams.setJSON(invitesKey, invites);

  storageLogger.debug({ teamId, email, role }, 'Team member invited');
  return invite;
}

/**
 * Get invite by token
 */
export async function getInviteByToken(token: string): Promise<TeamInvite | null> {
  return retryStorage(async () => {
    const teams = store();
    try {
      const mapping = (await teams.get(`invite_token_${token}`, {
        type: "json",
      })) as { inviteId: string } | null;

      if (!mapping) return null;

      const invite = (await teams.get(`invite_${mapping.inviteId}`, {
        type: "json",
      })) as TeamInvite | null;

      if (!invite) return null;

      // Check expiration
      if (new Date(invite.expiresAt) < new Date()) {
        await deleteInvite(invite.id);
        return null;
      }

      return invite;
    } catch (error) {
      storageLogger.warn({ token, error }, 'Invite lookup failed');
      return null;
    }
  }, 'getInviteByToken');
}

/**
 * Accept team invite
 */
export async function acceptInvite(
  inviteId: string,
  userId: string,
  userEmail: string
): Promise<TeamMember> {
  const teams = store();
  const invite = (await teams.get(`invite_${inviteId}`, {
    type: "json",
  })) as TeamInvite | null;

  if (!invite) {
    throw new Error("Invite not found");
  }

  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error("Email mismatch");
  }

  if (new Date(invite.expiresAt) < new Date()) {
    throw new Error("Invite expired");
  }

  // Create team member
  const memberId = "member_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  const member: TeamMember = {
    id: memberId,
    teamId: invite.teamId,
    userId,
    email: userEmail.toLowerCase(),
    role: invite.role,
    invitedBy: invite.invitedBy,
    invitedAt: invite.createdAt,
    joinedAt: new Date().toISOString(),
    status: 'active',
  };

  await teams.setJSON(`member_${invite.teamId}_${userId}`, member);
  await teams.setJSON(memberId, member);

  // Add to team members list
  const membersKey = `team_members_${invite.teamId}`;
  let members: string[] = [];
  try {
    members = (await teams.get(membersKey, { type: "json" })) as string[] | null || [];
  } catch {
    members = [];
  }
  members.push(memberId);
  await teams.setJSON(membersKey, members);

  // Add to user's teams list
  const userTeamsKey = `user_teams_${userId}`;
  let userTeams: string[] = [];
  try {
    userTeams = (await teams.get(userTeamsKey, { type: "json" })) as string[] | null || [];
  } catch {
    userTeams = [];
  }
  userTeams.push(invite.teamId);
  await teams.setJSON(userTeamsKey, userTeams);

  // Delete invite
  await deleteInvite(inviteId);

  storageLogger.debug({ teamId: invite.teamId, userId }, 'Invite accepted');
  return member;
}

/**
 * Remove team member
 */
export async function removeTeamMember(
  teamId: string,
  userId: string
): Promise<void> {
  const teams = store();

  // Get member to get the ID
  const member = await getTeamMember(teamId, userId);
  if (!member) return;

  // Delete member record
  await teams.delete(`member_${teamId}_${userId}`);
  await teams.delete(member.id);

  // Remove from team members list
  const membersKey = `team_members_${teamId}`;
  try {
    const members = (await teams.get(membersKey, { type: "json" })) as string[] | null || [];
    const filtered = members.filter((id) => id !== member.id);
    await teams.setJSON(membersKey, filtered);
  } catch {
    // Ignore
  }

  // Remove from user's teams list
  const userTeamsKey = `user_teams_${userId}`;
  try {
    const userTeams = (await teams.get(userTeamsKey, { type: "json" })) as string[] | null || [];
    const filtered = userTeams.filter((id) => id !== teamId);
    await teams.setJSON(userTeamsKey, filtered);
  } catch {
    // Ignore
  }

  storageLogger.debug({ teamId, userId }, 'Team member removed');
}

/**
 * Update member role
 */
export async function updateMemberRole(
  teamId: string,
  userId: string,
  role: 'admin' | 'editor' | 'viewer'
): Promise<TeamMember | null> {
  const teams = store();
  const member = await getTeamMember(teamId, userId);
  if (!member) return null;

  if (member.role === 'owner') {
    throw new Error("Cannot change owner role");
  }

  const updated: TeamMember = {
    ...member,
    role,
  };

  await teams.setJSON(`member_${teamId}_${userId}`, updated);
  await teams.setJSON(member.id, updated);

  storageLogger.debug({ teamId, userId, role }, 'Member role updated');
  return updated;
}

/**
 * Delete invite
 */
async function deleteInvite(inviteId: string): Promise<void> {
  const teams = store();
  const invite = (await teams.get(`invite_${inviteId}`, {
    type: "json",
  })) as TeamInvite | null;

  if (!invite) return;

  await teams.delete(`invite_${inviteId}`);
  await teams.delete(`invite_token_${invite.token}`);

  // Remove from team invites list
  const invitesKey = `team_invites_${invite.teamId}`;
  try {
    const invites = (await teams.get(invitesKey, { type: "json" })) as string[] | null || [];
    const filtered = invites.filter((id) => id !== inviteId);
    await teams.setJSON(invitesKey, filtered);
  } catch {
    // Ignore
  }
}

/**
 * Get pending invites for a team
 */
export async function getTeamInvites(teamId: string): Promise<TeamInvite[]> {
  return retryStorage(async () => {
    const teams = store();
    try {
      const inviteIds = (await teams.get(`team_invites_${teamId}`, {
        type: "json",
      })) as string[] | null || [];

      const invites = await Promise.all(
        inviteIds.map(async (id) => {
          try {
            return (await teams.get(`invite_${id}`, { type: "json" })) as TeamInvite | null;
          } catch {
            return null;
          }
        })
      );

      // Filter out expired invites
      const validInvites = invites.filter((inv): inv is TeamInvite => {
        if (!inv) return false;
        if (new Date(inv.expiresAt) < new Date()) {
          deleteInvite(inv.id);
          return false;
        }
        return true;
      });

      return validInvites;
    } catch (error) {
      storageLogger.warn({ teamId, error }, 'Team invites lookup failed');
      return [];
    }
  }, 'getTeamInvites');
}

// === PERMISSION CHECKING ===

export type TeamPermission =
  | 'team:manage'      // Manage team settings (owner only)
  | 'members:invite'   // Invite/remove members
  | 'members:manage'   // Change member roles
  | 'forms:create'     // Create forms
  | 'forms:edit'       // Edit forms
  | 'forms:delete'     // Delete forms
  | 'forms:view'       // View forms and submissions
  | 'billing:manage';  // Manage billing (owner only)

/**
 * Check if a user has a specific permission in a team
 */
export async function hasTeamPermission(
  teamId: string,
  userId: string,
  permission: TeamPermission
): Promise<boolean> {
  const member = await getTeamMember(teamId, userId);
  if (!member || member.status !== 'active') return false;

  const { role } = member;

  // Permission matrix
  const permissions: Record<typeof role, TeamPermission[]> = {
    owner: [
      'team:manage',
      'members:invite',
      'members:manage',
      'forms:create',
      'forms:edit',
      'forms:delete',
      'forms:view',
      'billing:manage',
    ],
    admin: [
      'members:invite',
      'members:manage',
      'forms:create',
      'forms:edit',
      'forms:delete',
      'forms:view',
    ],
    editor: [
      'forms:create',
      'forms:edit',
      'forms:view',
    ],
    viewer: [
      'forms:view',
    ],
  };

  return permissions[role].includes(permission);
}

/**
 * Verify user is a member of a team
 */
export async function verifyTeamMembership(
  teamId: string,
  userId: string
): Promise<boolean> {
  const member = await getTeamMember(teamId, userId);
  return member !== null && member.status === 'active';
}

// === HELPER FUNCTIONS ===

/**
 * Generate invite token
 */
function generateInviteToken(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
