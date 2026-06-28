import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { tasks, todos } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todo = await db.query.todos.findFirst({
    where: (t, { and, eq }) => and(eq(t.id, params.id), eq(t.userId, session.user.id)),
  });
  if (!todo) {
    return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  }

  const [task] = await db
    .insert(tasks)
    .values({
      userId: session.user.id,
      title: todo.title,
      description: todo.notes,
      priority: todo.priority,
      status: "backlog",
      dueDate: todo.dueDate,
    })
    .returning();

  await db.delete(todos).where(and(eq(todos.id, params.id), eq(todos.userId, session.user.id)));

  return NextResponse.json({ task }, { status: 201 });
}
