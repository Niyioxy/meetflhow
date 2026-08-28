import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { callRooms } from "@/db/schema";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";
import { deleteRoom } from "@/lib/daily/client";

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

  try {
    await getWorkspaceMember(session.user.id, callRoom.workspaceId);
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  if (callRoom.status === "active") {
    // Stops any in-progress recording and finalizes it — Daily fires
    // recording.ready-to-download shortly after, handled by the webhook.
    await deleteRoom(callRoom.dailyRoomName).catch((error) =>
      console.error("Failed to delete Daily room", error)
    );
    await db
      .update(callRooms)
      .set({ status: "ended", endedAt: new Date() })
      .where(eq(callRooms.id, callRoom.id));
  }

  return NextResponse.json({ ok: true });
}
