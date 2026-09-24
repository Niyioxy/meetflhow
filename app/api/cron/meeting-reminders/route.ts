import { NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/internal-auth";
import { and, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { scheduledMeetings } from "@/db/schema";
import { enqueueEffects, type EffectSpec } from "@/lib/processing/effects";
import { dispatchEffects } from "@/lib/processing/dispatch";

/**
 * Sends reminders for meetings starting in ~30 minutes, one ledger entry per
 * meeting — claimed before sending, so overlapping cron runs can't both
 * send the same reminder.
 */
export async function GET(req: Request) {
  const denied = checkCronSecret(req);
  if (denied) return denied;

  const now = Date.now();
  const windowStart = new Date(now + 25 * 60_000);
  const windowEnd = new Date(now + 35 * 60_000);

  const due = await db
    .select({ id: scheduledMeetings.id })
    .from(scheduledMeetings)
    .where(
      and(
        gte(scheduledMeetings.scheduledAt, windowStart),
        lte(scheduledMeetings.scheduledAt, windowEnd),
        isNull(scheduledMeetings.reminderSentAt)
      )
    );

  const specs: EffectSpec[] = due.map((meeting) => ({
    key: `meeting-reminder:${meeting.id}`,
    kind: "meeting_reminder",
    meetingId: null,
    payload: { scheduledMeetingId: meeting.id },
  }));
  await enqueueEffects(specs);
  const result = await dispatchEffects({ keys: specs.map((s) => s.key) });

  return NextResponse.json({ checked: due.length, sent: result.succeeded, ...result });
}
