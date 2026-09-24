import { randomUUID } from "crypto";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { meetingEvents, transcripts } from "@/db/schema";
import { transcribeAudio, type TranscriptUtterance } from "@/lib/deepgram/transcribe";
import { wordCount } from "@/lib/meetings";
import { matchSpeakersByVoice } from "@/lib/voice-identification";
import type { VoiceMatch } from "@/lib/voice-identification";
import { triggerInternalStep } from "@/lib/internal-auth";
import { logMeetingEvent } from "@/lib/meeting-events";
import { atomic } from "@/lib/processing/atomic";
import {
  claimStage,
  failQueuedStage,
  isLeaseLostError,
  leaseFence,
  releaseStage,
} from "@/lib/processing/lease";

export type TranscriptionOutcome = "handed_off" | "skipped" | "superseded" | "failed";

/**
 * Step 2 of the async meeting pipeline: transcribe the uploaded audio, store
 * the transcript, then hand off to analysis (and, independently, search
 * indexing).
 *
 * Runs only if it can claim the meeting's "transcribing" stage, so a
 * duplicate trigger — a retried hand-off, a provider redelivering its
 * webhook, a double retry click — does nothing, and in particular never
 * pays for a second Deepgram run. The transcript and the move to
 * "analyzing" commit together; the transient blob is only deleted after that
 * commit, so a failed commit can still be retried from the audio.
 */
export async function processTranscript(
  meetingId: string,
  blobUrl: string,
  userId: string,
  workspaceId: string | null
): Promise<TranscriptionOutcome> {
  const attemptId = await claimStage(meetingId, "transcribing");
  if (!attemptId) {
    console.info(`Transcription of meeting ${meetingId} not claimed: running elsewhere, done, or not queued`);
    return "skipped";
  }
  await logMeetingEvent(meetingId, "transcribing");

  let fullText: string;
  let utterances: TranscriptUtterance[];
  let voiceMatches: Record<string, VoiceMatch> = {};

  try {
    // A transcript can already exist if an earlier attempt committed it but
    // died before handing off — reuse it rather than transcribing again.
    const existing = await db.query.transcripts.findFirst({
      where: (t, { eq }) => eq(t.meetingId, meetingId),
    });

    let durationSeconds: number | undefined;
    let language: string | null = null;

    if (existing) {
      fullText = existing.fullText;
      utterances = existing.utterances ?? [];
    } else {
      const audioRes = await fetch(blobUrl);
      if (!audioRes.ok) {
        throw new Error(`Failed to fetch transient audio blob: ${audioRes.status}`);
      }
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
      const transcription = await transcribeAudio(new File([audioBuffer], "recording.webm"));
      fullText = transcription.text;
      utterances = transcription.utterances;
      language = transcription.language;
      if (transcription.durationSeconds) durationSeconds = Math.round(transcription.durationSeconds);

      if (utterances.length > 0) {
        try {
          voiceMatches = await matchSpeakersByVoice(audioBuffer, utterances, { userId, workspaceId });
        } catch (error) {
          console.error("Voice speaker matching failed", error);
        }
      }
    }

    await atomic([
      leaseFence(meetingId, attemptId),
      !existing &&
        db
          .insert(transcripts)
          .values({
            id: randomUUID(),
            meetingId,
            fullText,
            language,
            wordCount: wordCount(fullText),
            utterances: utterances.length > 0 ? utterances : null,
          })
          .onConflictDoNothing({ target: transcripts.meetingId }),
      releaseStage(meetingId, attemptId, "analyzing", {
        blobUrl: null,
        ...(durationSeconds ? { durationSeconds } : {}),
      }),
      db.insert(meetingEvents).values({ meetingId, event: "transcribed" }),
    ]);
  } catch (error) {
    if (isLeaseLostError(error)) {
      console.warn(`Transcription attempt ${attemptId} for meeting ${meetingId} was superseded`);
      return "superseded";
    }
    console.error("process-transcript failed", error);
    try {
      await atomic([
        leaseFence(meetingId, attemptId),
        releaseStage(meetingId, attemptId, "failed"),
        db.insert(meetingEvents).values({
          meetingId,
          event: "failed",
          detail: error instanceof Error ? error.message : "Transcription failed",
        }),
      ]);
    } catch (markError) {
      if (!isLeaseLostError(markError)) console.error("Failed to mark meeting failed", markError);
    }
    return "failed";
  }

  // Committed — everything below is after the fact. Transient hand-off only:
  // the audio isn't needed now that its transcript is stored.
  await del(blobUrl).catch((error) => console.error("Failed to delete transient audio blob", error));

  const transcript = await db.query.transcripts.findFirst({
    where: (t, { eq }) => eq(t.meetingId, meetingId),
  });

  // Best-effort, independent of the analysis hand-off below — indexing
  // failure must never mark this meeting failed.
  if (transcript) {
    triggerInternalStep(`/api/meetings/${meetingId}/process-index`, {
      transcriptId: transcript.id,
      fullText,
    }).catch((error) => console.error("Failed to trigger process-index", error));
  }

  try {
    await triggerInternalStep(`/api/meetings/${meetingId}/process-analysis`, {
      transcriptText: fullText,
      utterances,
      voiceMatches,
    });
  } catch (error) {
    console.error("Failed to hand off to process-analysis", error);
    if (await failQueuedStage(meetingId, "analyzing")) {
      await logMeetingEvent(meetingId, "failed", "Failed to start analysis");
    }
    return "failed";
  }
  return "handed_off";
}
