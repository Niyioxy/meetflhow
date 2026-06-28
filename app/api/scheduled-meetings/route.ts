import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { scheduledMeetings, scheduledMeetingPlatformEnum } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createCalendarEvent } from "@/lib/google/calendar";

const bodySchema = z.object({
  title: z.string().min(1),
  platform: z.enum(scheduledMeetingPlatformEnum),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480),
  attendees: z.array(z.string().email()).default([]),
  notes: z.string().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(scheduledMeetings)
    .where(eq(scheduledMeetings.userId, session.user.id))
    .orderBy(desc(scheduledMeetings.scheduledAt));

  return NextResponse.json({ scheduledMeetings: rows });
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

  const { title, platform, scheduledAt, durationMinutes, attendees, notes } = parsed.data;
  const startTime = new Date(scheduledAt);

  let meetLink: string | null = null;
  let googleEventId: string | null = null;

  if (platform === "Google Meet") {
    const result = await createCalendarEvent({
      userId: session.user.id,
      title,
      notes,
      startTime,
      durationMinutes,
      attendees,
      wantMeetLink: true,
    });
    if (result) {
      meetLink = result.meetLink;
      googleEventId = result.googleEventId;
    }
  }

  const [created] = await db
    .insert(scheduledMeetings)
    .values({
      userId: session.user.id,
      title,
      platform,
      scheduledAt: startTime,
      durationMinutes,
      attendees,
      notes,
      meetLink,
      googleEventId,
    })
    .returning();

  return NextResponse.json({ scheduledMeeting: created }, { status: 201 });
}
