import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { mentions } from "@/db/schema";
import type { MentionContextType } from "@/db/schema";
import { getResendClient } from "@/lib/resend/client";
import { MentionNotificationEmail } from "@/lib/emails/mention-notification";
import type { MentionableMember, MentionView } from "@/types/mentions";

export async function getMentionableMembers(workspaceId: string): Promise<MentionableMember[]> {
  const rows = await db.query.workspaceMembers.findMany({
    where: (m, { eq }) => eq(m.workspaceId, workspaceId),
    with: { user: { columns: { id: true, name: true, email: true, image: true } } },
  });
  return rows.map((r) => ({
    id: r.user.id,
    name: r.user.name,
    email: r.user.email,
    image: r.user.image,
  }));
}

async function parseMentions(text: string, workspaceId: string): Promise<MentionableMember[]> {
  const members = await getMentionableMembers(workspaceId);
  const lowerText = text.toLowerCase();
  return members.filter((m) => m.name && lowerText.includes(`@${m.name.toLowerCase()}`));
}

export async function createMentionsForContent({
  fromUserId,
  workspaceId,
  contextType,
  contextId,
  contextText,
  meetingId,
  text,
}: {
  fromUserId: string;
  workspaceId: string | null;
  contextType: MentionContextType;
  contextId: string;
  contextText: string;
  meetingId: string | null;
  text: string;
}): Promise<void> {
  if (!workspaceId) return;

  const matched = await parseMentions(text, workspaceId);
  const targets = matched.filter((m) => m.id !== fromUserId);
  if (targets.length === 0) return;

  const [fromUser, meeting] = await Promise.all([
    db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, fromUserId) }),
    meetingId ? db.query.meetings.findFirst({ where: (m, { eq }) => eq(m.id, meetingId) }) : null,
  ]);

  await db.insert(mentions).values(
    targets.map((t) => ({
      fromUserId,
      toUserId: t.id,
      contextType,
      contextId,
      contextText,
      meetingId,
    }))
  );

  await Promise.all(
    targets.map((t) =>
      sendMentionEmail(
        t.email,
        fromUser?.name ?? "Someone",
        meeting?.title ?? "MeetFlhow",
        contextType,
        contextText,
        meetingId
      )
    )
  );
}

async function sendMentionEmail(
  toEmail: string,
  fromName: string,
  meetingTitle: string,
  contextType: MentionContextType,
  contextText: string,
  meetingId: string | null
) {
  try {
    const url = meetingId ? `${process.env.NEXTAUTH_URL}/meetings/${meetingId}` : `${process.env.NEXTAUTH_URL}/dashboard`;
    await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || "MeetFlhow <reminders@meetflow.app>",
      to: [toEmail],
      subject: `${fromName} mentioned you in ${meetingTitle}`,
      react: MentionNotificationEmail({ fromName, meetingTitle, contextType, contextText, url }),
    });
  } catch (error) {
    console.error("Failed to send mention notification email", error);
  }
}

export async function listMentionsForUser(userId: string, limit = 20): Promise<MentionView[]> {
  const rows = await db.query.mentions.findMany({
    where: (m, { eq }) => eq(m.toUserId, userId),
    orderBy: (m, { desc }) => desc(m.createdAt),
    limit,
    with: {
      fromUser: { columns: { name: true } },
      meeting: { columns: { title: true } },
    },
  });

  return rows.map((m) => ({
    id: m.id,
    from_user_id: m.fromUserId,
    from_user_name: m.fromUser.name,
    context_type: m.contextType,
    context_id: m.contextId,
    context_text: m.contextText,
    meeting_id: m.meetingId,
    meeting_title: m.meeting?.title ?? null,
    read: m.read,
    created_at: m.createdAt.toISOString(),
  }));
}

export async function unreadMentionCount(userId: string): Promise<number> {
  const rows = await db.query.mentions.findMany({
    where: (m, { and, eq }) => and(eq(m.toUserId, userId), eq(m.read, false)),
    columns: { id: true },
  });
  return rows.length;
}

export async function markAllMentionsRead(userId: string): Promise<void> {
  await db.update(mentions).set({ read: true }).where(and(eq(mentions.toUserId, userId), eq(mentions.read, false)));
}

export async function markMentionRead(mentionId: string, userId: string): Promise<void> {
  await db.update(mentions).set({ read: true }).where(and(eq(mentions.id, mentionId), eq(mentions.toUserId, userId)));
}
