import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { scheduledMeetings, scheduledMeetingPlatformEnum } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createCalendarEvent } from "@/lib/google/calendar";
import { createTeamsMeeting } from "@/lib/microsoft/calendar";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";

const bodySchema = z
  .object({
    title: z.string().min(1),
    platform: z.enum(scheduledMeetingPlatformEnum),
    scheduledAt: z.string().datetime(),
    durationMinutes: z.number().int().min(5).max(480),
    attendees: z.array(z.string().email()).default([]),
    notes: z.string().nullable().optional(),
    // Required when platform is "MeetFlhow Audio" — the workspace whose
    // members can join the in-app call.
    workspaceId: z.string().uuid().optional(),
  })
  .refine((data) => data.platform !== "MeetFlhow Audio" || Boolean(data.workspaceId), {
    message: "workspaceId is required for MeetFlhow Audio meetings",
    path: ["workspaceId"],
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

  const { title, platform, scheduledAt, durationMinutes, attendees, notes, workspaceId } =
    parsed.data;
  const startTime = new Date(scheduledAt);

  if (platform === "MeetFlhow Audio") {
    try {
      await getWorkspaceMember(session.user.id, workspaceId!);
    } catch (error) {
      return workspaceErrorResponse(error);
    }
  }

  let meetLink: string | null = null;
  let googleEventId: string | null = null;
  let microsoftEventId: string | null = null;

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

  if (platform === "Microsoft Teams") {
    const result = await createTeamsMeeting({
      userId: session.user.id,
      title,
      notes,
      startTime,
      durationMinutes,
      attendees,
    });
    if (result) {
      meetLink = result.meetLink;
      microsoftEventId = result.microsoftEventId;
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
      microsoftEventId,
      workspaceId: platform === "MeetFlhow Audio" ? workspaceId : null,
    })
    .returning();

  return NextResponse.json({ scheduledMeeting: created }, { status: 201 });
}
