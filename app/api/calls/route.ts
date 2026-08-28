import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { callRooms } from "@/db/schema";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";
import { createRoom } from "@/lib/daily/client";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
});

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
  const { workspaceId } = parsed.data;

  try {
    await getWorkspaceMember(session.user.id, workspaceId);
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  const roomName = `meetflhow-${randomUUID()}`;

  try {
    await createRoom(roomName);
  } catch (error) {
    console.error("Failed to create Daily room", error);
    return NextResponse.json({ error: "Failed to start call" }, { status: 500 });
  }

  const [callRoom] = await db
    .insert(callRooms)
    .values({
      workspaceId,
      createdBy: session.user.id,
      dailyRoomName: roomName,
    })
    .returning();

  return NextResponse.json({ callRoomId: callRoom.id });
}
