import { randomUUID } from "crypto";
import { db } from "@/db";
import { workspaces, workspaceMembers, workspaceInvites, meetings } from "@/db/schema";
import type { WorkspaceRole } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { colorFromName } from "@/lib/avatar";
import { getWorkspaceMember, requireRole, WorkspaceAccessError } from "@/lib/workspace-auth";
import { getResendClient } from "@/lib/resend/client";
import { WorkspaceInviteEmail } from "@/lib/emails/workspace-invite";
import type {
  WorkspaceSummary,
  WorkspaceDetail,
  WorkspaceInviteView,
  InvitePreview,
} from "@/types/workspace";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_EXPIRY_DAYS = 7;

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "workspace";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  for (let attempt = 0; attempt < 6; attempt++) {
    const existing = await db.query.workspaces.findFirst({ where: (w, { eq }) => eq(w.slug, slug) });
    if (!existing) return slug;
    slug = `${base}-${randomUUID().slice(0, 4)}`;
  }
  throw new Error("Could not generate a unique workspace slug");
}

export async function findWorkspaceByIdOrSlug(idOrSlug: string) {
  return UUID_RE.test(idOrSlug)
    ? db.query.workspaces.findFirst({ where: (w, { eq }) => eq(w.id, idOrSlug) })
    : db.query.workspaces.findFirst({ where: (w, { eq }) => eq(w.slug, idOrSlug) });
}

export async function createWorkspace(userId: string, name: string): Promise<WorkspaceSummary> {
  const slug = await uniqueSlug(name);
  const [workspace] = await db
    .insert(workspaces)
    .values({ name, slug, ownerId: userId, avatarColor: colorFromName(name) })
    .returning();

  await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId, role: "owner" });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan,
    avatar_color: workspace.avatarColor,
    role: "owner",
  };
}

export async function listUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  const rows = await db.query.workspaceMembers.findMany({
    where: (m, { eq }) => eq(m.userId, userId),
    with: { workspace: true },
    orderBy: (m, { asc }) => asc(m.joinedAt),
  });

  return rows
    .filter((r) => r.workspace)
    .map((r) => ({
      id: r.workspace.id,
      name: r.workspace.name,
      slug: r.workspace.slug,
      plan: r.workspace.plan,
      avatar_color: r.workspace.avatarColor,
      role: r.role,
    }));
}

export async function getWorkspaceDetail(idOrSlug: string, userId: string): Promise<WorkspaceDetail> {
  const workspace = await findWorkspaceByIdOrSlug(idOrSlug);
  if (!workspace) throw new WorkspaceAccessError("Workspace not found", 404);

  const member = await getWorkspaceMember(userId, workspace.id);

  const memberRows = await db.query.workspaceMembers.findMany({
    where: (m, { eq }) => eq(m.workspaceId, workspace.id),
    with: { user: true },
    orderBy: (m, { asc }) => asc(m.joinedAt),
  });

  const inviteRows = await db.query.workspaceInvites.findMany({
    where: (i, { and, eq, isNull }) => and(eq(i.workspaceId, workspace.id), isNull(i.acceptedAt)),
    orderBy: (i, { desc }) => desc(i.createdAt),
  });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan,
    avatar_color: workspace.avatarColor,
    role: member.role,
    owner_id: workspace.ownerId,
    members: memberRows.map((m) => ({
      id: m.id,
      user_id: m.userId,
      name: m.user.name,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      joined_at: m.joinedAt.toISOString(),
    })),
    pending_invites: inviteRows.map(toInviteView),
  };
}

function toInviteView(i: typeof workspaceInvites.$inferSelect): WorkspaceInviteView {
  return {
    id: i.id,
    email: i.email,
    role: i.role,
    expires_at: i.expiresAt ? i.expiresAt.toISOString() : null,
    created_at: i.createdAt.toISOString(),
  };
}

export async function updateWorkspace(
  workspaceId: string,
  userId: string,
  patch: { name?: string }
): Promise<WorkspaceSummary> {
  const member = await getWorkspaceMember(userId, workspaceId);
  requireRole(member, "admin");

  const [updated] = await db
    .update(workspaces)
    .set(patch)
    .where(eq(workspaces.id, workspaceId))
    .returning();

  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    plan: updated.plan,
    avatar_color: updated.avatarColor,
    role: member.role,
  };
}

export async function deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
  const member = await getWorkspaceMember(userId, workspaceId);
  requireRole(member, "owner");

  await db
    .update(meetings)
    .set({ workspaceId: null, sharedWithWorkspace: false })
    .where(eq(meetings.workspaceId, workspaceId));

  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}

export async function changeMemberRole(
  workspaceId: string,
  actingUserId: string,
  targetUserId: string,
  role: WorkspaceRole
): Promise<void> {
  const actor = await getWorkspaceMember(actingUserId, workspaceId);
  requireRole(actor, "admin");

  const target = await getWorkspaceMember(targetUserId, workspaceId);
  if (target.role === "owner") {
    throw new WorkspaceAccessError("Cannot change the owner's role", 400);
  }
  if (role === "owner") {
    throw new WorkspaceAccessError("Cannot promote a member to owner", 400);
  }

  await db
    .update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)));
}

export async function removeMember(
  workspaceId: string,
  actingUserId: string,
  targetUserId: string
): Promise<void> {
  const actor = await getWorkspaceMember(actingUserId, workspaceId);
  requireRole(actor, "admin");

  const target = await getWorkspaceMember(targetUserId, workspaceId);
  if (target.role === "owner") {
    throw new WorkspaceAccessError("Cannot remove the workspace owner", 400);
  }

  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, targetUserId)));
}

export async function createInvite(
  workspaceId: string,
  inviterUserId: string,
  email: string,
  role: WorkspaceRole
): Promise<WorkspaceInviteView> {
  const inviter = await getWorkspaceMember(inviterUserId, workspaceId);
  requireRole(inviter, "admin");
  if (role === "owner") {
    throw new WorkspaceAccessError("Cannot invite someone directly as owner", 400);
  }

  const workspace = await db.query.workspaces.findFirst({ where: (w, { eq }) => eq(w.id, workspaceId) });
  if (!workspace) throw new WorkspaceAccessError("Workspace not found", 404);

  const inviterUser = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, inviterUserId) });

  const [invite] = await db
    .insert(workspaceInvites)
    .values({
      workspaceId,
      email: email.toLowerCase(),
      role,
      token: randomUUID(),
      invitedBy: inviterUserId,
      expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    })
    .returning();

  const acceptUrl = `${process.env.NEXTAUTH_URL}/invite/${invite.token}`;
  try {
    await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || "MeetFlhow <reminders@meetflow.app>",
      to: [email],
      subject: `${inviterUser?.name ?? "Someone"} invited you to ${workspace.name} on MeetFlhow`,
      react: WorkspaceInviteEmail({
        inviterName: inviterUser?.name ?? "A MeetFlhow user",
        workspaceName: workspace.name,
        role,
        acceptUrl,
      }),
    });
  } catch (error) {
    console.error("Failed to send workspace invite email", error);
  }

  return toInviteView(invite);
}

export async function cancelInvite(workspaceId: string, userId: string, inviteId: string): Promise<void> {
  const member = await getWorkspaceMember(userId, workspaceId);
  requireRole(member, "admin");

  await db
    .delete(workspaceInvites)
    .where(and(eq(workspaceInvites.id, inviteId), eq(workspaceInvites.workspaceId, workspaceId)));
}

export async function getInvitePreview(token: string): Promise<InvitePreview> {
  const invite = await db.query.workspaceInvites.findFirst({
    where: (i, { eq }) => eq(i.token, token),
    with: { workspace: true },
  });
  if (!invite) throw new WorkspaceAccessError("Invite not found", 404);

  const inviter = invite.invitedBy
    ? await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, invite.invitedBy!) })
    : null;

  return {
    workspace_name: invite.workspace.name,
    inviter_name: inviter?.name ?? null,
    role: invite.role,
    expired: Boolean(invite.expiresAt && invite.expiresAt.getTime() < Date.now()),
    already_accepted: Boolean(invite.acceptedAt),
  };
}

export async function acceptInvite(token: string, userId: string, userEmail: string): Promise<WorkspaceSummary> {
  const invite = await db.query.workspaceInvites.findFirst({
    where: (i, { eq }) => eq(i.token, token),
    with: { workspace: true },
  });
  if (!invite) throw new WorkspaceAccessError("Invite not found", 404);
  if (invite.acceptedAt) throw new WorkspaceAccessError("Invite already accepted", 400);
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    throw new WorkspaceAccessError("Invite has expired", 400);
  }
  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new WorkspaceAccessError("This invite was sent to a different email address", 403);
  }

  const existingMember = await db.query.workspaceMembers.findFirst({
    where: (m, { and, eq }) => and(eq(m.workspaceId, invite.workspaceId), eq(m.userId, userId)),
  });

  if (!existingMember) {
    await db.insert(workspaceMembers).values({
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
      invitedBy: invite.invitedBy,
    });
  }

  await db.update(workspaceInvites).set({ acceptedAt: new Date() }).where(eq(workspaceInvites.id, invite.id));

  return {
    id: invite.workspace.id,
    name: invite.workspace.name,
    slug: invite.workspace.slug,
    plan: invite.workspace.plan,
    avatar_color: invite.workspace.avatarColor,
    role: existingMember?.role ?? invite.role,
  };
}
