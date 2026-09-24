/**
 * Type-level canary, checked by `tsc` (never executed). Drizzle's relational
 * query types for `meetings` have silently degraded to `any` before, once
 * the schema's relations got complex enough (see lib/no-show-recap.ts) —
 * and `any` type-checks everything, so nothing failed. If that happens
 * again, each @ts-expect-error below stops erroring and tsc fails here.
 */
import { db } from "@/db";

export async function drizzleTypesCanary() {
  const meeting = await db.query.meetings.findFirst({
    with: { transcript: true, analysis: true, actionItems: true },
  });
  if (!meeting) return;

  // @ts-expect-error title is a string
  const title: number = meeting.title;
  // @ts-expect-error processingStartedAt is a Date | null
  const startedAt: number = meeting.processingStartedAt;
  // @ts-expect-error coreCompletedAt is a Date | null
  const completedAt: number = meeting.analysis!.coreCompletedAt;
  // @ts-expect-error fullText is a string
  const fullText: number = meeting.transcript!.fullText;
  // @ts-expect-error task is a string
  const task: number = meeting.actionItems[0].task;

  return [title, startedAt, completedAt, fullText, task];
}
