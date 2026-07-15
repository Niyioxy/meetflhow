import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { runAllMeetingAnalyses } from "@/lib/meetings";
import { checkInternalSecret } from "@/lib/internal-auth";
import type { TranscriptUtterance } from "@/lib/deepgram/transcribe";
import type { VoiceMatch } from "@/lib/voice-identification";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Step 3 of the async meeting pipeline — acks near-instantly, see process-transcript's route for why. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const authError = checkInternalSecret(req);
  if (authError) return authError;

  const meetingId = params.id;
  const { transcriptText, utterances, voiceMatches } = await req.json();

  waitUntil(processAnalysis(meetingId, transcriptText, utterances, voiceMatches));

  return NextResponse.json({ accepted: true });
}

async function processAnalysis(
  meetingId: string,
  transcriptText: string,
  utterances: TranscriptUtterance[] | undefined,
  voiceMatches: Record<string, VoiceMatch> | undefined
) {
  try {
    // Sets status to ready/failed itself and fires webhooks/Slack on completion.
    await runAllMeetingAnalyses(meetingId, transcriptText, [], utterances, voiceMatches);
  } catch (error) {
    console.error("process-analysis failed", error);
  }
}
