import { del } from "@vercel/blob";
import { and, eq, like } from "drizzle-orm";
import { db } from "@/db";
import { meetingEvents } from "@/db/schema";
import { deleteRecording } from "@/lib/daily/client";

// MeetFlhow doesn't keep raw meeting audio: it is a transient hand-off to the
// transcriber. Uploads live in Vercel Blob; in-app call recordings live in
// Daily's own storage. Which one a meeting used is remembered as an
// "uploaded" event carrying the Daily recording id.

const DAILY_RECORDING_PREFIX = "daily-recording:";

export function dailyRecordingEventDetail(recordingId: string): string {
  return `${DAILY_RECORDING_PREFIX}${recordingId}`;
}

async function findDailyRecordingId(meetingId: string): Promise<string | null> {
  const [row] = await db
    .select({ detail: meetingEvents.detail })
    .from(meetingEvents)
    .where(
      and(
        eq(meetingEvents.meetingId, meetingId),
        eq(meetingEvents.event, "uploaded"),
        like(meetingEvents.detail, `${DAILY_RECORDING_PREFIX}%`)
      )
    )
    .limit(1);
  return row?.detail ? row.detail.slice(DAILY_RECORDING_PREFIX.length) : null;
}

/**
 * Best-effort removal of a meeting's source audio, wherever it is stored. Never
 * throws: callers run it after their own work has committed (or while deleting
 * the meeting), and a storage hiccup must not undo that. Failures are logged.
 * Deleting an already-removed recording is a no-op, so calling this again —
 * e.g. when the meeting is later deleted — is safe and retries a failed one.
 */
export async function deleteTransientAudio(meetingId: string, audioUrl: string | null | undefined): Promise<void> {
  try {
    const dailyRecordingId = await findDailyRecordingId(meetingId);
    if (dailyRecordingId) {
      // audioUrl is Daily's signed download link — only Daily can delete it.
      await deleteRecording(dailyRecordingId);
    } else if (audioUrl) {
      await del(audioUrl);
    }
  } catch (error) {
    console.error("Failed to delete transient audio", { meetingId, error });
  }
}
