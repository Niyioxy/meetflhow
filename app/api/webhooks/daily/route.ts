import crypto, { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { callRooms, meetings } from "@/db/schema";
import { triggerInternalStep } from "@/lib/internal-auth";
import { atomic } from "@/lib/processing/atomic";

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

        if (callRoom) {
          let meetingId = callRoom.meetingId;

          if (!meetingId) {
            // Daily redelivers webhooks, possibly concurrently. Create the
            // meeting and link it to the room in one transaction, undoing the
            // insert in that same transaction if another delivery linked the
            // room first — so exactly one meeting is ever created per room.
            const candidateId = randomUUID();
            await atomic([
              db.insert(meetings).values({
                id: candidateId,
                userId: callRoom.createdBy,
                workspaceId: callRoom.workspaceId,
                sharedWithWorkspace: true,
                title: "Call recording",
                platform: "meetflhow-call",
                contentType: "meeting",
                status: "transcribing",
                blobUrl: downloadLink,
              }),
              db
                .update(callRooms)
                .set({ meetingId: candidateId })
                .where(and(eq(callRooms.id, callRoom.id), isNull(callRooms.meetingId))),
              db
                .delete(meetings)
                .where(
                  and(
                    eq(meetings.id, candidateId),
                    sql`not exists (select 1 from ${callRooms} where ${callRooms.meetingId} = ${candidateId})`
                  )
                ),
            ]);

            const linked = await db.query.callRooms.findFirst({
              where: (c, { eq }) => eq(c.id, callRoom.id),
            });
            meetingId = linked?.meetingId ?? null;
          }

          // (Re)hand off while the meeting still awaits transcription, so a
          // redelivery also recovers a hand-off that failed last time.
          // Harmless if transcription is already running or finished:
          // process-transcript only acts if it can claim the meeting.
          const meeting = meetingId
            ? await db.query.meetings.findFirst({ where: (m, { eq }) => eq(m.id, meetingId!) })
            : null;
          if (meeting?.status === "transcribing" && meeting.blobUrl) {
            await triggerInternalStep(`/api/meetings/${meeting.id}/process-transcript`, {
              blobUrl: meeting.blobUrl,
              userId: meeting.userId,
              workspaceId: meeting.workspaceId,
            });
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process Daily webhook", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
