import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { actionItems, actionItemStatusEnum } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  status: z.enum(actionItemStatusEnum).optional(),
  dueDate: z.string().nullable().optional(),
  owner: z.string().nullable().optional(),
});

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

  const { status, dueDate, owner } = parsed.data;
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

  const [updated] = await db
    .update(actionItems)
    .set(updates)
    .where(and(eq(actionItems.id, params.id), eq(actionItems.meetingId, item.meetingId)))
    .returning();

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
