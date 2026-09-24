import { NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/internal-auth";
import { and, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { outboundEffects, scheduledFollowUpEmails } from "@/db/schema";
import { enqueueEffects, type EffectSpec } from "@/lib/processing/effects";
import { dispatchEffects } from "@/lib/processing/dispatch";

/**
 * Sends due scheduled follow-up emails through the delivery ledger: each
 * email is one ledger entry, claimed before sending, so overlapping cron
 * runs can't both send it and a sent email is never sent again.
 */
export async function GET(req: Request) {
  const denied = checkCronSecret(req);
  if (denied) return denied;

  const due = await db
    .select({ id: scheduledFollowUpEmails.id, meetingId: scheduledFollowUpEmails.meetingId })
    .from(scheduledFollowUpEmails)
    .where(
      and(
        lte(scheduledFollowUpEmails.sendAt, new Date()),
        isNull(scheduledFollowUpEmails.sentAt)
      )
    );

  const specs: EffectSpec[] = due.map((email) => ({
    key: `follow-up-email:${email.id}`,
    kind: "follow_up_email",
    meetingId: email.meetingId,
    payload: { followUpEmailId: email.id },
  }));
  await enqueueEffects(specs);
  const result = await dispatchEffects({ keys: specs.map((s) => s.key) });

  // If a send succeeded but marking sentAt didn't, the ledger still knows —
  // copy it across so the email stops showing as unsent.
  await db.execute(sql`
    update ${scheduledFollowUpEmails} set sent_at = e.completed_at
    from ${outboundEffects} e
    where e.effect_key = 'follow-up-email:' || ${scheduledFollowUpEmails.id}
      and e.status = 'succeeded'
      and ${scheduledFollowUpEmails.sentAt} is null
  `);

  return NextResponse.json({ checked: due.length, sent: result.succeeded, ...result });
}
