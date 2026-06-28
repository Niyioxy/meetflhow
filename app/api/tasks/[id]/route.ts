import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { tasks, priorityEnum, taskStatusEnum } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(priorityEnum).optional(),
  status: z.enum(taskStatusEnum).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  meetingId: z.string().uuid().nullable().optional(),
});

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

  const existing = await db.query.tasks.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, params.id), eq(t.userId, session.user.id)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { dueDate, ...rest } = parsed.data;

  const [updated] = await db
    .update(tasks)
    .set({
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    })
    .where(and(eq(tasks.id, params.id), eq(tasks.userId, session.user.id)))
    .returning();

  return NextResponse.json({ task: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.query.tasks.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, params.id), eq(t.userId, session.user.id)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await db.delete(tasks).where(and(eq(tasks.id, params.id), eq(tasks.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
