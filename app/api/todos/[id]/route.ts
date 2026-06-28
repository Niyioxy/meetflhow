import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { todos, priorityEnum } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  priority: z.enum(priorityEnum).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  isComplete: z.boolean().optional(),
});

async function getOwnedTodo(id: string, userId: string) {
  return db.query.todos.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, id), eq(t.userId, userId)),
  });
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

  const existing = await getOwnedTodo(params.id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  const { dueDate, ...rest } = parsed.data;

  const [updated] = await db
    .update(todos)
    .set({
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    })
    .where(and(eq(todos.id, params.id), eq(todos.userId, session.user.id)))
    .returning();

  return NextResponse.json({ todo: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getOwnedTodo(params.id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  await db.delete(todos).where(and(eq(todos.id, params.id), eq(todos.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
