import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";
import { createMeetingToken } from "@/lib/daily/client";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const callRoom = await db.query.callRooms.findFirst({
    where: (c, { eq }) => eq(c.id, params.id),
  });
  if (!callRoom) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }
  if (callRoom.status !== "active") {
    return NextResponse.json({ error: "This call has ended" }, { status: 400 });
  }

  try {
    await getWorkspaceMember(session.user.id, callRoom.workspaceId);
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  const domain = process.env.DAILY_DOMAIN;
  if (!domain) {
    return NextResponse.json({ error: "Calling is not configured on this server yet" }, { status: 503 });
  }

  try {
    const token = await createMeetingToken({
      roomName: callRoom.dailyRoomName,
      userName: session.user.name || session.user.email || "MeetFlhow user",
      isOwner: callRoom.createdBy === session.user.id,
    });

    return NextResponse.json({
      token,
      roomUrl: `https://${domain}.daily.co/${callRoom.dailyRoomName}`,
      isOwner: callRoom.createdBy === session.user.id,
    });
  } catch (error) {
    console.error("Failed to create Daily meeting token", error);
    return NextResponse.json({ error: "Failed to join call" }, { status: 500 });
  }
}
