import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { tasks, priorityEnum, taskStatusEnum } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  priority: z.enum(priorityEnum).default("medium"),
  status: z.enum(taskStatusEnum).default("backlog"),
  dueDate: z.string().datetime().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  meetingId: z.string().uuid().nullable().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const priority = url.searchParams.get("priority");
  const meetingId = url.searchParams.get("meetingId");
  const dueDate = url.searchParams.get("dueDate");

  const conditions = [eq(tasks.userId, session.user.id)];
  if (priority && (priorityEnum as readonly string[]).includes(priority)) {
    conditions.push(eq(tasks.priority, priority as (typeof priorityEnum)[number]));
  }
  if (meetingId) {
    conditions.push(eq(tasks.meetingId, meetingId));
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt));

  const filtered = dueDate
    ? rows.filter((t) => t.dueDate && t.dueDate.toISOString().slice(0, 10) === dueDate)
    : rows;

  return NextResponse.json({ tasks: filtered });
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
    .insert(tasks)
    .values({
      userId: session.user.id,
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  return NextResponse.json({ task: created }, { status: 201 });
}
