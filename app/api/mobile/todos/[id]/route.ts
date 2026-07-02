import { NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { db } from "@/db";
import { todos } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json() as Partial<{
    title: string;
    isComplete: boolean;
    priority: string;
    dueDate: string | null;
    notes: string;
  }>;

  const allowed: Record<string, unknown> = {};
  if (body.title !== undefined) allowed.title = body.title;
  if (body.isComplete !== undefined) allowed.isComplete = body.isComplete;
  if (body.priority !== undefined) allowed.priority = body.priority;
  if (body.dueDate !== undefined) allowed.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.notes !== undefined) allowed.notes = body.notes;

  const [updated] = await db
    .update(todos)
    .set(allowed)
    .where(and(eq(todos.id, id), eq(todos.userId, user.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(updated);
}
