import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";
import { db } from "@/db";
import { meetings, transcripts } from "@/db/schema";
import { transcribeAudio } from "@/lib/deepgram/transcribe";
import { wordCount } from "@/lib/meetings";
import { matchSpeakersByVoice } from "@/lib/voice-identification";
import type { VoiceMatch } from "@/lib/voice-identification";
import { checkInternalSecret, triggerInternalStep } from "@/lib/internal-auth";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Step 2 of the async meeting pipeline. Acks near-instantly (see waitUntil
 * below) so the caller (the upload route) only pays for this hand-off's
 * latency, not this step's own transcription time — each step gets its own
 * ~60s budget instead of the whole pipeline sharing one.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const authError = checkInternalSecret(req);
  if (authError) return authError;

  const meetingId = params.id;
  const { blobUrl, userId, workspaceId } = await req.json();

  waitUntil(processTranscript(meetingId, blobUrl, userId, workspaceId));

  return NextResponse.json({ accepted: true });
}

async function processTranscript(
  meetingId: string,
  blobUrl: string,
  userId: string,
  workspaceId: string | null
) {
  try {
    const audioRes = await fetch(blobUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch transient audio blob: ${audioRes.status}`);
    }
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    const file = new File([audioBuffer], "recording.webm");

    const transcription = await transcribeAudio(file);

    await db.insert(transcripts).values({
      meetingId,
      fullText: transcription.text,
      language: transcription.language,
      wordCount: wordCount(transcription.text),
    });

    if (transcription.durationSeconds) {
      await db
        .update(meetings)
        .set({ durationSeconds: Math.round(transcription.durationSeconds) })
        .where(eq(meetings.id, meetingId));
    }

    let voiceMatches: Record<string, VoiceMatch> = {};
    if (transcription.utterances.length > 0) {
      try {
        voiceMatches = await matchSpeakersByVoice(audioBuffer, transcription.utterances, {
          userId,
          workspaceId,
        });
      } catch (error) {
        console.error("Voice speaker matching failed", error);
      }
    }

    // Transient handoff only — delete now that Deepgram has consumed it.
    await del(blobUrl).catch((error) => console.error("Failed to delete transient audio blob", error));

    await db.update(meetings).set({ status: "analyzing" }).where(eq(meetings.id, meetingId));

    await triggerInternalStep(`/api/meetings/${meetingId}/process-analysis`, {
      transcriptText: transcription.text,
      utterances: transcription.utterances,
      voiceMatches,
    });
  } catch (error) {
    console.error("process-transcript failed", error);
    await db.update(meetings).set({ status: "failed" }).where(eq(meetings.id, meetingId));
  }
}
