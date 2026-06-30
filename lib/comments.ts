import { eq } from "drizzle-orm";
import { db } from "@/db";
import { transcriptComments, transcriptCommentReplies } from "@/db/schema";
import { getMeetingDetail } from "@/lib/meetings";
import { getWorkspaceMember, requireRole, WorkspaceAccessError } from "@/lib/workspace-auth";
import { getResendClient } from "@/lib/resend/client";
import { CommentNotificationEmail } from "@/lib/emails/comment-notification";
import { createMentionsForContent } from "@/lib/mentions";
import type { CommentReplyView, TranscriptCommentView } from "@/types/comments";

async function ensureCanView(meetingId: string, userId: string) {
  const meeting = await getMeetingDetail(meetingId, userId);
  if (!meeting) throw new WorkspaceAccessError("Meeting not found", 404);
  return meeting;
}

async function ensureCanComment(meetingId: string, userId: string) {
  const meeting = await ensureCanView(meetingId, userId);
  if (meeting.userId !== userId && meeting.workspaceId) {
    const member = await getWorkspaceMember(userId, meeting.workspaceId);
    requireRole(member, "member");
  }
  return meeting;
}

function toReplyView(r: typeof transcriptCommentReplies.$inferSelect & {
  user: { name: string | null; image: string | null };
}): CommentReplyView {
  return {
    id: r.id,
    user_id: r.userId,
    user_name: r.user.name,
    user_image: r.user.image,
    reply: r.reply,
    created_at: r.createdAt.toISOString(),
  };
}

function toCommentView(
  c: typeof transcriptComments.$inferSelect & {
    user: { name: string | null; image: string | null };
    replies: (typeof transcriptCommentReplies.$inferSelect & {
      user: { name: string | null; image: string | null };
    })[];
  }
): TranscriptCommentView {
  return {
    id: c.id,
    meeting_id: c.meetingId,
    user_id: c.userId,
    user_name: c.user.name,
    user_image: c.user.image,
    segment_index: c.segmentIndex,
    selected_text: c.selectedText,
    comment: c.comment,
    resolved: c.resolved,
    resolved_by: c.resolvedBy,
    resolved_at: c.resolvedAt ? c.resolvedAt.toISOString() : null,
    created_at: c.createdAt.toISOString(),
    replies: c.replies.map(toReplyView),
  };
}

export async function listComments(meetingId: string, userId: string): Promise<TranscriptCommentView[]> {
  await ensureCanView(meetingId, userId);

  const rows = await db.query.transcriptComments.findMany({
    where: (c, { eq }) => eq(c.meetingId, meetingId),
    with: {
      user: { columns: { name: true, image: true } },
      replies: {
        with: { user: { columns: { name: true, image: true } } },
        orderBy: (r, { asc }) => asc(r.createdAt),
      },
    },
    orderBy: (c, { asc }) => asc(c.createdAt),
  });

  return rows.map(toCommentView);
}

export async function createComment(
  meetingId: string,
  userId: string,
  data: { segment_index: number; selected_text: string; comment: string }
): Promise<TranscriptCommentView> {
  const meeting = await ensureCanComment(meetingId, userId);

  const [created] = await db
    .insert(transcriptComments)
    .values({
      meetingId,
      userId,
      segmentIndex: data.segment_index,
      selectedText: data.selected_text,
      comment: data.comment,
    })
    .returning();

  if (meeting.userId !== userId) {
    await notifyMeetingOwner(meeting.userId, meeting.id, meeting.title, userId, data.comment);
  }

  await createMentionsForContent({
    fromUserId: userId,
    workspaceId: meeting.workspaceId,
    contextType: "comment",
    contextId: created.id,
    contextText: data.comment,
    meetingId: meeting.id,
    text: data.comment,
  });

  const [withRelations] = await db.query.transcriptComments.findMany({
    where: (c, { eq }) => eq(c.id, created.id),
    with: {
      user: { columns: { name: true, image: true } },
      replies: { with: { user: { columns: { name: true, image: true } } } },
    },
  });

  return toCommentView(withRelations);
}

async function notifyMeetingOwner(
  ownerId: string,
  meetingId: string,
  meetingTitle: string,
  commenterId: string,
  commentText: string
) {
  try {
    const [owner, commenter] = await Promise.all([
      db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, ownerId) }),
      db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, commenterId) }),
    ]);
    if (!owner) return;

    await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || "MeetFlhow <reminders@meetflow.app>",
      to: [owner.email],
      subject: `New comment on ${meetingTitle}`,
      react: CommentNotificationEmail({
        commenterName: commenter?.name ?? "Someone",
        meetingTitle,
        commentText,
        meetingUrl: `${process.env.NEXTAUTH_URL}/meetings/${meetingId}`,
      }),
    });
  } catch (error) {
    console.error("Failed to send comment notification email", error);
  }
}

async function getOwnedComment(commentId: string, userId: string) {
  const comment = await db.query.transcriptComments.findFirst({
    where: (c, { eq }) => eq(c.id, commentId),
  });
  if (!comment) throw new WorkspaceAccessError("Comment not found", 404);
  if (comment.userId !== userId) throw new WorkspaceAccessError("You can only edit your own comments", 403);
  return comment;
}

export async function updateComment(commentId: string, userId: string, text: string) {
  await getOwnedComment(commentId, userId);
  await db.update(transcriptComments).set({ comment: text }).where(eq(transcriptComments.id, commentId));
}

export async function deleteComment(commentId: string, userId: string) {
  await getOwnedComment(commentId, userId);
  await db.delete(transcriptComments).where(eq(transcriptComments.id, commentId));
}

export async function toggleResolveComment(commentId: string, userId: string) {
  const comment = await db.query.transcriptComments.findFirst({
    where: (c, { eq }) => eq(c.id, commentId),
  });
  if (!comment) throw new WorkspaceAccessError("Comment not found", 404);

  await ensureCanComment(comment.meetingId, userId);

  const resolved = !comment.resolved;
  await db
    .update(transcriptComments)
    .set({
      resolved,
      resolvedBy: resolved ? userId : null,
      resolvedAt: resolved ? new Date() : null,
    })
    .where(eq(transcriptComments.id, commentId));

  return resolved;
}

export async function addReply(commentId: string, userId: string, text: string): Promise<CommentReplyView> {
  const comment = await db.query.transcriptComments.findFirst({
    where: (c, { eq }) => eq(c.id, commentId),
  });
  if (!comment) throw new WorkspaceAccessError("Comment not found", 404);

  await ensureCanComment(comment.meetingId, userId);

  const [created] = await db
    .insert(transcriptCommentReplies)
    .values({ commentId, userId, reply: text })
    .returning();

  const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) });

  return {
    id: created.id,
    user_id: userId,
    user_name: user?.name ?? null,
    user_image: user?.image ?? null,
    reply: created.reply,
    created_at: created.createdAt.toISOString(),
  };
}

export async function listReplies(commentId: string, userId: string): Promise<CommentReplyView[]> {
  const comment = await db.query.transcriptComments.findFirst({
    where: (c, { eq }) => eq(c.id, commentId),
  });
  if (!comment) throw new WorkspaceAccessError("Comment not found", 404);

  await ensureCanView(comment.meetingId, userId);

  const rows = await db.query.transcriptCommentReplies.findMany({
    where: (r, { eq }) => eq(r.commentId, commentId),
    with: { user: { columns: { name: true, image: true } } },
    orderBy: (r, { asc }) => asc(r.createdAt),
  });

  return rows.map(toReplyView);
}
