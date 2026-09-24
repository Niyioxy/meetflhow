import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { scheduledFollowUpEmails, scheduledMeetings, type OutboundEffectKind } from "@/db/schema";
import { deliverWebhookEffect } from "@/lib/webhooks";
import { postMeetingToSlack } from "@/lib/integrations/slack";
import { sendNoShowRecapEffect } from "@/lib/no-show-recap";
import { sendFollowUpEmail } from "@/lib/email/follow-up";
import { sendMeetingReminderEmail } from "@/lib/email/reminder";
import {
  findClaimableEffects,
  runEffect,
  stableMessageId,
  type EffectHandler,
  type EffectResult,
} from "@/lib/processing/effects";

const slackAutoPost: EffectHandler = async (effect) => {
  const { meetingId, includeSummary, includeActionItems } = effect.payload as {
    meetingId: string;
    includeSummary: boolean;
    includeActionItems: boolean;
  };
  const result = await postMeetingToSlack(meetingId, { includeSummary, includeActionItems });
  return result.ok
    ? { status: "succeeded" }
    : { status: "failed", error: result.error ?? "Slack post failed" };
};

const followUpEmail: EffectHandler = async (effect) => {
  const { followUpEmailId } = effect.payload as { followUpEmailId: string };
  const email = await db.query.scheduledFollowUpEmails.findFirst({
    where: (e, { eq: eqOp }) => eqOp(e.id, followUpEmailId),
  });
  if (!email) return { status: "cancelled", reason: "Scheduled email was deleted" };
  if (email.sentAt) return { status: "succeeded" };

  await sendFollowUpEmail({
    to: email.recipients,
    replyTo: email.replyTo,
    subject: email.subject,
    bodyHtml: email.bodyHtml,
    messageId: stableMessageId(effect.effectKey),
  });
  // Best-effort: the ledger entry, not sentAt, is what prevents a resend.
  await db
    .update(scheduledFollowUpEmails)
    .set({ sentAt: new Date() })
    .where(and(eq(scheduledFollowUpEmails.id, email.id), isNull(scheduledFollowUpEmails.sentAt)))
    .catch((error) => console.error(`Failed to mark follow-up email ${email.id} sent`, error));
  return { status: "succeeded" };
};

const meetingReminder: EffectHandler = async (effect) => {
  const { scheduledMeetingId } = effect.payload as { scheduledMeetingId: string };
  const meeting = await db.query.scheduledMeetings.findFirst({
    where: (m, { eq: eqOp }) => eqOp(m.id, scheduledMeetingId),
    with: { user: true },
  });
  if (!meeting) return { status: "cancelled", reason: "Scheduled meeting was deleted" };
  if (meeting.reminderSentAt) return { status: "succeeded" };
  if (meeting.scheduledAt.getTime() <= Date.now()) {
    return { status: "cancelled", reason: "Meeting already started" };
  }

  await sendMeetingReminderEmail({
    to: meeting.user.email,
    title: meeting.title,
    scheduledAt: meeting.scheduledAt,
    platform: meeting.platform,
    meetLink: meeting.meetLink,
    messageId: stableMessageId(effect.effectKey),
  });
  await db
    .update(scheduledMeetings)
    .set({ reminderSentAt: new Date() })
    .where(and(eq(scheduledMeetings.id, meeting.id), isNull(scheduledMeetings.reminderSentAt)))
    .catch((error) => console.error(`Failed to mark reminder for ${meeting.id} sent`, error));
  return { status: "succeeded" };
};

const handlers: Record<OutboundEffectKind, EffectHandler> = {
  webhook: deliverWebhookEffect,
  slack_auto_post: slackAutoPost,
  no_show_recap: sendNoShowRecapEffect,
  follow_up_email: followUpEmail,
  meeting_reminder: meetingReminder,
};

export interface DispatchSummary {
  attempted: number;
  succeeded: number;
  failed: number;
  cancelled: number;
}

/**
 * Attempts every claimable ledger entry in scope. Safe to call from several
 * places at once — each entry is claimed by exactly one caller.
 */
export async function dispatchEffects(
  scope: { meetingId?: string; keys?: string[] } = {},
  limit = 100
): Promise<DispatchSummary> {
  const effects = await findClaimableEffects(scope, limit);
  const results = await Promise.all(
    effects.map((effect) =>
      runEffect(effect.id, handlers[effect.kind]).catch((error): EffectResult => {
        console.error(`Dispatching effect ${effect.effectKey} failed`, error);
        return { status: "failed", error: String(error) };
      })
    )
  );

  const summary: DispatchSummary = { attempted: 0, succeeded: 0, failed: 0, cancelled: 0 };
  for (const result of results) {
    if (!result) continue; // claimed by someone else in the meantime
    summary.attempted += 1;
    summary[result.status] += 1;
  }
  return summary;
}
