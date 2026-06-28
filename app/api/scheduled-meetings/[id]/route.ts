import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { scheduledMeetings, scheduledMeetingPlatformEnum } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { deleteCalendarEvent, updateCalendarEvent } from "@/lib/google/calendar";

const bodySchema = z.object({
  title: z.string().min(1).optional(),
  platform: z.enum(scheduledMeetingPlatformEnum).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  attendees: z.array(z.string().email()).optional(),
  notes: z.string().nullable().optional(),
});

async function getOwnedMeeting(id: string, userId: string) {
  return db.query.scheduledMeetings.findFirst({
    where: (m, { and, eq }) => and(eq(m.id, id), eq(m.userId, userId)),
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

  const existing = await getOwnedMeeting(params.id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Scheduled meeting not found" }, { status: 404 });
  }

  const update = parsed.data;
  const scheduledAt = update.scheduledAt ? new Date(update.scheduledAt) : existing.scheduledAt;
  const durationMinutes = update.durationMinutes ?? existing.durationMinutes;

  if (existing.googleEventId) {
    await updateCalendarEvent(session.user.id, existing.googleEventId, {
      title: update.title ?? existing.title,
      notes: update.notes ?? existing.notes,
      startTime: scheduledAt,
      durationMinutes,
      attendees: update.attendees ?? existing.attendees,
    });
  }

  const [updated] = await db
    .update(scheduledMeetings)
    .set({
      ...update,
      scheduledAt,
      durationMinutes,
    })
    .where(and(eq(scheduledMeetings.id, params.id), eq(scheduledMeetings.userId, session.user.id)))
    .returning();

  return NextResponse.json({ scheduledMeeting: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getOwnedMeeting(params.id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Scheduled meeting not found" }, { status: 404 });
  }

  if (existing.googleEventId) {
    await deleteCalendarEvent(session.user.id, existing.googleEventId);
  }

  await db
    .delete(scheduledMeetings)
    .where(and(eq(scheduledMeetings.id, params.id), eq(scheduledMeetings.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
