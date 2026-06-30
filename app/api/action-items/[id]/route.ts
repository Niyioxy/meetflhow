import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { actionItems, actionItemStatusEnum, mentions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getResendClient } from "@/lib/resend/client";
import { ActionItemAssignedEmail } from "@/lib/emails/action-item-assigned";
import { triggerWebhooks } from "@/lib/webhooks";

const bodySchema = z.object({
  status: z.enum(actionItemStatusEnum).optional(),
  dueDate: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
});

async function notifyAssignee(
  assigneeUserId: string,
  fromUserId: string,
  item: { id: string; task: string; deadline: string | null },
  meeting: { id: string; title: string }
) {
  if (assigneeUserId === fromUserId) return;

  await db.insert(mentions).values({
    fromUserId,
    toUserId: assigneeUserId,
    contextType: "action_item",
    contextId: item.id,
    contextText: item.task,
    meetingId: meeting.id,
  });

  try {
    const assignee = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, assigneeUserId) });
    if (!assignee) return;

    await getResendClient().emails.send({
      from: process.env.EMAIL_FROM || "MeetFlhow <reminders@meetflow.app>",
      to: [assignee.email],
      subject: `You've been assigned an action item in ${meeting.title}`,
      react: ActionItemAssignedEmail({
        meetingTitle: meeting.title,
        task: item.task,
        deadline: item.deadline,
        url: `${process.env.NEXTAUTH_URL}/meetings/${meeting.id}`,
      }),
    });
  } catch (error) {
    console.error("Failed to send action item assignment email", error);
  }
}

async function getOwnedItem(id: string, userId: string) {
  const item = await db.query.actionItems.findFirst({
    where: (a, { eq }) => eq(a.id, id),
    with: { meeting: true },
  });
  if (!item || item.meeting.userId !== userId) return null;
  return item;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const item = await getOwnedItem(params.id, session.user.id);
  if (!item) {
    return NextResponse.json({ error: "Action item not found" }, { status: 404 });
  }

  const { status, dueDate, owner, assigneeUserId } = parsed.data;
  const updates: Partial<typeof actionItems.$inferInsert> = {};

  if (status !== undefined) {
    updates.status = status;
    updates.completedAt = status === "done" ? new Date() : null;
  }
  if (dueDate !== undefined) {
    updates.dueDate = dueDate;
  }
  if (owner !== undefined) {
    updates.owner = owner;
  }

  if (assigneeUserId !== undefined) {
    updates.assigneeUserId = assigneeUserId;
    if (assigneeUserId) {
      const assignee = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, assigneeUserId) });
      updates.owner = assignee?.name ?? assignee?.email ?? owner ?? null;
    }
  }

  const [updated] = await db
    .update(actionItems)
    .set(updates)
    .where(and(eq(actionItems.id, params.id), eq(actionItems.meetingId, item.meetingId)))
    .returning();

  if (assigneeUserId && assigneeUserId !== item.assigneeUserId) {
    await notifyAssignee(
      assigneeUserId,
      session.user.id,
      { id: updated.id, task: updated.task, deadline: updated.deadline },
      { id: item.meeting.id, title: item.meeting.title }
    );
  }

  if (status === "done" && item.status !== "done") {
    await triggerWebhooks(item.meeting.workspaceId, "action_item.completed", {
      action_item_id: updated.id,
      task: updated.task,
      owner: updated.owner,
      due_date: updated.dueDate,
      meeting_id: item.meeting.id,
    });
  }

  return NextResponse.json({ actionItem: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await getOwnedItem(params.id, session.user.id);
  if (!item) {
    return NextResponse.json({ error: "Action item not found" }, { status: 404 });
  }

  await db.delete(actionItems).where(eq(actionItems.id, params.id));

  return NextResponse.json({ success: true });
}
