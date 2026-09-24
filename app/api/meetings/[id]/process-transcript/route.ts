import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { checkInternalSecret } from "@/lib/internal-auth";
import { processTranscript } from "@/lib/processing/transcribe";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Step 2 of the async meeting pipeline. Acks near-instantly (see waitUntil
 * below) so the caller (the upload route) only pays for this hand-off's
 * latency, not this step's own transcription time — each step gets its own
 * ~60s budget instead of the whole pipeline sharing one. Duplicate calls
 * are harmless: processTranscript only runs if it can claim the meeting.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const authError = checkInternalSecret(req);
  if (authError) return authError;

  const meetingId = params.id;
  const { blobUrl, userId, workspaceId } = await req.json();

  waitUntil(
    processTranscript(meetingId, blobUrl, userId, workspaceId).catch((error) =>
      console.error("process-transcript failed", error)
    )
  );

  return NextResponse.json({ accepted: true });
}
