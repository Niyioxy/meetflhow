import { randomUUID } from "crypto";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { meetings, transcripts, type MeetingStatus } from "@/db/schema";

/**
 * Processing lease for the meeting pipeline.
 *
 * `meetings.status` names the stage a meeting is in; the lease columns say
 * whether a worker currently owns that stage:
 *
 *   (transcribing | analyzing, attempt = null)  queued: anyone may claim it
 *   (transcribing | analyzing, attempt = A)     owned by A until the lease expires
 *   (ready | failed, attempt = null)            terminal; only requeueMeeting moves it
 *
 * Transitions:
 *   upload/webhook   -> transcribing (queued)
 *   claimStage       -> same status, attempt = new id
 *   commit transcript-> analyzing (queued)   [fenced, see leaseFence]
 *   commit analysis  -> ready                [fenced]
 *   any stage error  -> failed               [fenced]
 *   requeueMeeting   -> failed, or a stage whose lease went stale -> queued
 *
 * A duplicate trigger (retried hand-off, provider redelivery, double click)
 * fails to claim and does nothing. The lease is longer than any function's
 * maxDuration, so a stale lease means its worker is dead — but the fence
 * still guards the commit in case a slow worker outlives it anyway.
 */
// Must exceed the longest maxDuration of any route that runs a stage (analyze: 300s).
export const PROCESSING_LEASE_MS = 10 * 60_000;

export type ProcessingStage = Extract<MeetingStatus, "transcribing" | "analyzing">;

const leaseInterval = sql.raw(`interval '${PROCESSING_LEASE_MS / 1000} seconds'`);

const LEASE_LOST_MARKER = "processing_lease_lost";

/**
 * Atomically takes ownership of the meeting's current stage. Returns the new
 * attempt id, or null if the meeting isn't in that stage or another attempt
 * holds a live lease on it. Analysis additionally requires a transcript.
 */
export async function claimStage(meetingId: string, stage: ProcessingStage): Promise<string | null> {
  const attemptId = randomUUID();
  const conditions = [
    eq(meetings.id, meetingId),
    eq(meetings.status, stage),
    or(
      isNull(meetings.processingAttemptId),
      sql`${meetings.processingStartedAt} < now() - ${leaseInterval}`
    ),
  ];
  if (stage === "analyzing") {
    conditions.push(
      sql`exists (select 1 from ${transcripts} where ${transcripts.meetingId} = ${meetingId})`
    );
  }

  const claimed = await db
    .update(meetings)
    .set({ processingAttemptId: attemptId, processingStartedAt: sql`now()` })
    .where(and(...conditions))
    .returning({ id: meetings.id });

  return claimed.length > 0 ? attemptId : null;
}

/**
 * First statement of every batch that commits a stage's output: row-locks
 * the meeting for the rest of the transaction and aborts the whole batch if
 * `attemptId` no longer owns it (see meetflhow_assert_processing_lease in
 * drizzle/0021_idempotent_processing.sql).
 */
export function leaseFence(meetingId: string, attemptId: string) {
  return db.execute(
    sql`select meetflhow_assert_processing_lease(${meetingId}::uuid, ${attemptId}::uuid)`
  );
}

/** Moves the meeting on to `status` and gives up the lease. Only matches while `attemptId` owns it. */
export function releaseStage(
  meetingId: string,
  attemptId: string,
  status: MeetingStatus,
  extra: Partial<Pick<typeof meetings.$inferInsert, "blobUrl" | "durationSeconds">> = {}
) {
  return db
    .update(meetings)
    .set({ ...extra, status, processingAttemptId: null, processingStartedAt: sql`now()` })
    .where(and(eq(meetings.id, meetingId), eq(meetings.processingAttemptId, attemptId)));
}

/**
 * Queues a meeting to run `stage` again — from "failed", or from a stage
 * that's stuck because its worker died (lease, or queued slot, gone stale).
 * Returns false if neither applies, e.g. it's already running or a second
 * retry click got there first.
 */
export async function requeueMeeting(meetingId: string, stage: ProcessingStage): Promise<boolean> {
  const requeued = await db
    .update(meetings)
    .set({ status: stage, processingAttemptId: null, processingStartedAt: sql`now()` })
    .where(
      and(
        eq(meetings.id, meetingId),
        or(
          eq(meetings.status, "failed"),
          and(
            inArray(meetings.status, ["transcribing", "analyzing"]),
            sql`coalesce(${meetings.processingStartedAt}, ${meetings.createdAt}) < now() - ${leaseInterval}`
          )
        )
      )
    )
    .returning({ id: meetings.id });
  return requeued.length > 0;
}

/**
 * Marks a queued (unowned) stage failed — for when handing the meeting to
 * its next stage fails after the previous stage already released its lease.
 */
export async function failQueuedStage(meetingId: string, stage: ProcessingStage): Promise<boolean> {
  const failed = await db
    .update(meetings)
    .set({ status: "failed", processingStartedAt: sql`now()` })
    .where(
      and(
        eq(meetings.id, meetingId),
        eq(meetings.status, stage),
        isNull(meetings.processingAttemptId)
      )
    )
    .returning({ id: meetings.id });
  return failed.length > 0;
}

/** True if a batch was aborted by leaseFence — another attempt owns the meeting now. */
export function isLeaseLostError(error: unknown): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if (e instanceof Error && e.message.includes(LEASE_LOST_MARKER)) return true;
    if (typeof e !== "object") break;
  }
  return false;
}
