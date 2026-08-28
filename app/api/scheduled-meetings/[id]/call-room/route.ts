import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { callRooms, scheduledMeetings } from "@/db/schema";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";
import { createRoom } from "@/lib/daily/client";

/**
 * Lazily provisions (or returns the existing) Daily call room for a
 * "MeetFlhow Audio" scheduled meeting, so the room isn't created — and its
 * expiry clock isn't started — until someone actually tries to join.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await db.query.scheduledMeetings.findFirst({
    where: (m, { eq }) => eq(m.id, params.id),
  });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  if (meeting.platform !== "MeetFlhow Audio" || !meeting.workspaceId) {
    return NextResponse.json({ error: "This meeting isn't an in-app call" }, { status: 400 });
  }

  try {
    await getWorkspaceMember(session.user.id, meeting.workspaceId);
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  if (meeting.callRoomId) {
    return NextResponse.json({ callRoomId: meeting.callRoomId });
  }

  const roomName = `meetflhow-${randomUUID()}`;
  const expiresAt =
    Math.floor(meeting.scheduledAt.getTime() / 1000) + meeting.durationMinutes * 60 + 60 * 60;

  try {
    await createRoom(roomName, expiresAt);
  } catch (error) {
    console.error("Failed to create Daily room for scheduled meeting", error);
    return NextResponse.json({ error: "Failed to start call" }, { status: 500 });
  }

  const [callRoom] = await db
    .insert(callRooms)
    .values({
      workspaceId: meeting.workspaceId,
      createdBy: meeting.userId,
      dailyRoomName: roomName,
    })
    .returning();

  await db
    .update(scheduledMeetings)
    .set({ callRoomId: callRoom.id })
    .where(eq(scheduledMeetings.id, meeting.id));

  return NextResponse.json({ callRoomId: callRoom.id });
}
