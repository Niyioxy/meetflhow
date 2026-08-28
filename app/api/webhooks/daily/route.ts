import crypto from "crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { callRooms, meetings } from "@/db/schema";
import { triggerInternalStep } from "@/lib/internal-auth";

export const runtime = "nodejs";

function verifySignature(rawBody: string, timestamp: string, signature: string): boolean {
  const secret = process.env.DAILY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`${timestamp}.${rawBody}`)
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(req: Request) {
  const timestamp = req.headers.get("x-webhook-timestamp");
  const signature = req.headers.get("x-webhook-signature");

  if (!timestamp || !signature) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
  }

  const rawBody = await req.text();

  let valid = false;
  try {
    valid = verifySignature(rawBody, timestamp, signature);
  } catch (error) {
    console.error("Daily webhook signature check failed", error);
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);

  try {
    if (event.type === "recording.ready-to-download") {
      const roomName: string | undefined = event.payload?.room_name;
      const downloadLink: string | undefined = event.payload?.download_link;

      if (roomName && downloadLink) {
        const callRoom = await db.query.callRooms.findFirst({
          where: (c, { eq }) => eq(c.dailyRoomName, roomName),
        });

        if (callRoom && !callRoom.meetingId) {
          const [meeting] = await db
            .insert(meetings)
            .values({
              userId: callRoom.createdBy,
              workspaceId: callRoom.workspaceId,
              sharedWithWorkspace: true,
              title: "Call recording",
              platform: "meetflhow-call",
              contentType: "meeting",
              status: "transcribing",
              blobUrl: downloadLink,
            })
            .returning();

          await db
            .update(callRooms)
            .set({ meetingId: meeting.id })
            .where(eq(callRooms.id, callRoom.id));

          await triggerInternalStep(`/api/meetings/${meeting.id}/process-transcript`, {
            blobUrl: downloadLink,
            userId: callRoom.createdBy,
            workspaceId: callRoom.workspaceId,
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process Daily webhook", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
