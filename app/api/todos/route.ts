import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { todos, priorityEnum } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  priority: z.enum(priorityEnum).default("medium"),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, session.user.id))
    .orderBy(desc(todos.createdAt));

  return NextResponse.json({ todos: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { dueDate, ...rest } = parsed.data;

  const [created] = await db
    .insert(todos)
    .values({
      userId: session.user.id,
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  // Note: "todo.created" is a selectable webhook event, but todos have no
  // workspace association in this schema (purely personal, userId-only), so
  // there's no workspace to scope a delivery to. Left unwired until todos
  // gain a workspace concept.

  return NextResponse.json({ todo: created }, { status: 201 });
}

/** Bulk-deletes all of the current user's completed todos. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .delete(todos)
    .where(and(eq(todos.userId, session.user.id), eq(todos.isComplete, true)));

  return NextResponse.json({ ok: true });
}
