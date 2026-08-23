import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { indexTranscript } from "@/lib/search/index-transcript";
import { checkInternalSecret } from "@/lib/internal-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Fired in parallel with process-analysis after transcription — indexes the
 * transcript for "Ask your meetings" search. Best-effort background
 * enhancement: never affects the meeting's own success/failure status.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const authError = checkInternalSecret(req);
  if (authError) return authError;

  const meetingId = params.id;
  const { transcriptId, fullText } = await req.json();

  waitUntil(processIndex(transcriptId, meetingId, fullText));

  return NextResponse.json({ accepted: true });
}

async function processIndex(transcriptId: string, meetingId: string, fullText: string) {
  try {
    await indexTranscript(transcriptId, meetingId, fullText);
  } catch (error) {
    console.error("process-index failed", error);
  }
}
