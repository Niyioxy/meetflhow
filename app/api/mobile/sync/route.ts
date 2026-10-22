import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getMobileUser } from "@/lib/mobile-auth";
import { isOwnMobileBlobUrl, mobileUploadPrefix } from "@/lib/blob-urls";
import { db } from "@/db";
import { meetingEvents, meetings } from "@/db/schema";
import { triggerInternalStep } from "@/lib/internal-auth";
import { logMeetingEvent } from "@/lib/meeting-events";
import { failQueuedStage, requeueMeeting } from "@/lib/processing/lease";

export const runtime = "nodejs";
export const maxDuration = 60;

const recordingSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().optional(),
  platform: z.string().optional(),
  recorded_at: z.string().optional(),
  duration: z.number().nonnegative().optional(),
  // Current apps upload straight to Blob (see /api/mobile/upload-token) and
  // send the resulting URL. audio_base64 is the legacy path for older app
  // builds; it can't carry more than a few minutes of audio (Vercel's 4.5 MB
  // request body limit).
  audio_base64: z.string().min(1).optional(),
  blob_url: z.string().url().optional(),
}).refine((rec) => rec.audio_base64 || rec.blob_url, { message: "audio_base64 or blob_url is required" });

const bodySchema = z.object({ recordings: z.array(recordingSchema).min(1) });

type SyncStatus = "queued" | "upload_failed" | "error";

// The device's local recording id, recorded on the "uploaded" event. A retry
// of a recording we already received (e.g. the response was lost, or the
// processing hand-off failed) reuses that meeting instead of creating a
// duplicate. Kept in meeting_events rather than a new `meetings` column — see
// the type-complexity note in lib/no-show-recap.ts.
function syncKey(userId: string, localId: string) {
  return `mobile-sync:${userId}:${localId}`;
}

async function startTranscription(meeting: { id: string; userId: string; blobUrl: string }) {
  try {
    await triggerInternalStep(`/api/meetings/${meeting.id}/process-transcript`, {
      blobUrl: meeting.blobUrl,
      userId: meeting.userId,
      workspaceId: null,
    });
    return true;
  } catch (error) {
    console.error("Mobile sync hand-off failed", error);
    if (await failQueuedStage(meeting.id, "transcribing")) {
      await logMeetingEvent(meeting.id, "failed", "Failed to start transcription");
    }
    return false;
  }
}

async function findSyncedMeeting(userId: string, localId: string) {
  const [row] = await db
    .select({
      id: meetings.id,
      status: meetings.status,
      blobUrl: meetings.blobUrl,
    })
    .from(meetingEvents)
    .innerJoin(meetings, eq(meetings.id, meetingEvents.meetingId))
    .where(
      and(
        eq(meetingEvents.event, "uploaded"),
        eq(meetingEvents.detail, syncKey(userId, localId)),
        eq(meetings.userId, userId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function POST(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "recordings array required" }, { status: 400 });
  }

  const results: { localId: string; meetingId: string; status: SyncStatus }[] = [];

  for (const rec of parsed.data.recordings) {
    try {
      if (rec.blob_url && !isOwnMobileBlobUrl(user.id, rec.blob_url)) {
        results.push({ localId: rec.id, meetingId: "", status: "error" });
        continue;
      }

      const existing = await findSyncedMeeting(user.id, rec.id);
      if (existing) {
        // The phone uploaded again before learning we already had this one;
        // that copy will never be processed, so don't leave it in storage.
        if (rec.blob_url && rec.blob_url !== existing.blobUrl) {
          await del(rec.blob_url).catch(() => undefined);
        }
        // Only a hand-off that never got going needs another push; anything
        // else is already in (or through) the pipeline, so the device can
        // drop its copy.
        let ok = true;
        if (existing.status === "failed" && existing.blobUrl) {
          if (await requeueMeeting(existing.id, "transcribing")) {
            await logMeetingEvent(existing.id, "retried", "Retrying mobile sync hand-off");
            ok = await startTranscription({ id: existing.id, userId: user.id, blobUrl: existing.blobUrl });
          }
        }
        results.push({ localId: rec.id, meetingId: existing.id, status: ok ? "queued" : "upload_failed" });
        continue;
      }

      // Same transient handoff as the web upload flow: the blob lives only
      // until process-transcript has fed it to Deepgram, then it's deleted.
      const blob = rec.blob_url
        ? { url: rec.blob_url }
        : await put(
            `${mobileUploadPrefix(user.id)}${rec.id}.m4a`,
            Buffer.from(rec.audio_base64!, "base64"),
            { access: "public", contentType: "audio/m4a", addRandomSuffix: true }
          );

      const recordedAt = rec.recorded_at ? new Date(rec.recorded_at) : null;
      const [meeting] = await db
        .insert(meetings)
        .values({
          userId: user.id,
          title: rec.title?.trim() || "Offline Recording",
          platform: rec.platform || "other",
          contentType: "meeting",
          durationSeconds: rec.duration != null ? Math.round(rec.duration) : null,
          status: "transcribing",
          blobUrl: blob.url,
          ...(recordedAt && !Number.isNaN(recordedAt.getTime()) ? { createdAt: recordedAt } : {}),
        })
        .returning();

      await logMeetingEvent(meeting.id, "uploaded", syncKey(user.id, rec.id));

      const ok = await startTranscription({ id: meeting.id, userId: user.id, blobUrl: blob.url });
      results.push({ localId: rec.id, meetingId: meeting.id, status: ok ? "queued" : "upload_failed" });
    } catch (error) {
      console.error("Mobile sync failed", { localId: rec.id, error });
      results.push({ localId: rec.id, meetingId: "", status: "error" });
    }
  }

  return NextResponse.json({ results });
}
