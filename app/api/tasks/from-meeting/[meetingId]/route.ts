import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: Request,
  { params }: { params: { meetingId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await db.query.meetings.findFirst({
    where: (m, { and, eq }) => and(eq(m.id, params.meetingId), eq(m.userId, session.user.id)),
    with: { actionItems: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const existingTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(eq(tasks.meetingId, meeting.id));

  if (existingTasks.length > 0) {
    return NextResponse.json({ created: 0, message: "Tasks already exist for this meeting" });
  }

  if (meeting.actionItems.length === 0) {
    return NextResponse.json({ created: 0, message: "No action items on this meeting" });
  }

  const created = await db
    .insert(tasks)
    .values(
      meeting.actionItems.map((item) => ({
        userId: session.user.id,
        meetingId: meeting.id,
        title: item.task,
        priority: item.priority,
        status: "backlog" as const,
        assignedTo: item.owner,
      }))
    )
    .returning();

  return NextResponse.json({ created: created.length, tasks: created }, { status: 201 });
}
