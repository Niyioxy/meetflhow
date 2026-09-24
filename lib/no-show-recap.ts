import { db } from "@/db";
import { sendMeetingRecapEmail } from "@/lib/meeting-recap";
import { stableMessageId, type EffectResult, type EffectSpec } from "@/lib/processing/effects";

/**
 * How close a scheduled meeting's start time and a recording's createdAt
 * have to be to treat them as "the same meeting" — wide enough to survive
 * a recording starting a few minutes late or being uploaded after the
 * call ended, narrow enough not to match an unrelated meeting that
 * happens to share a title.
 */
const MATCH_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Finds who should be auto-emailed a recap: anyone who was invited (per a heuristically
 * matched scheduled meeting's attendee list) but never actually spoke in
 * the recording, per voice ID. There's no explicit FK tying a recording
 * back to its calendar invite — adding one to the meetings table pushed
 * Drizzle's relational-query type inference for that table past some
 * complexity threshold and silently degraded types to `any` in unrelated
 * files across the codebase, which isn't worth it for this. Instead this
 * matches by the same organizer + normalized title + scheduled time
 * within MATCH_WINDOW_MS of when the recording was made — the same
 * approach lib/zombie-meetings.ts already uses to group recurring
 * meetings without a schema change.
 * Only trusts identificationMethod "voice_match" for presence, never
 * "ai_inference" — an AI-guessed speaker label isn't reliable enough to
 * clear someone as "attended" and skip their recap.
 */
export async function noShowRecapEffects(meetingId: string): Promise<EffectSpec[]> {
  const meeting = await db.query.meetings.findFirst({
    where: (m, { eq }) => eq(m.id, meetingId),
    with: { transcript: true, user: true },
  });
  if (!meeting?.transcript?.speakerSegments) return [];

  const normalizedTitle = meeting.title.trim().toLowerCase();
  if (!normalizedTitle) return [];

  const candidates = await db.query.scheduledMeetings.findMany({
    where: (sm, { eq }) => eq(sm.userId, meeting.userId),
  });

  const scheduledMeeting = candidates.find(
    (sm) =>
      sm.title.trim().toLowerCase() === normalizedTitle &&
      sm.attendees.length > 0 &&
      Math.abs(sm.scheduledAt.getTime() - meeting.createdAt.getTime()) <= MATCH_WINDOW_MS
  );
  if (!scheduledMeeting) return [];

  const presentUserIds = Array.from(
    new Set(
      meeting.transcript.speakerSegments
        .filter((s) => s.identificationMethod === "voice_match" && s.matchedUserId)
        .map((s) => s.matchedUserId as string)
    )
  );

  const presentUsers =
    presentUserIds.length > 0
      ? await db.query.users.findMany({ where: (u, { inArray }) => inArray(u.id, presentUserIds) })
      : [];

  const presentEmails = new Set(
    presentUsers.map((u) => u.email?.toLowerCase()).filter((e): e is string => Boolean(e))
  );
  if (meeting.user.email) presentEmails.add(meeting.user.email.toLowerCase());

  const noShowEmails = scheduledMeeting.attendees.filter(
    (email) => !presentEmails.has(email.toLowerCase())
  );

  // One ledger entry per recipient, so a retried analysis never re-emails
  // someone whose recap already went out.
  return Array.from(new Set(noShowEmails.map((e) => e.toLowerCase()))).map((email) => ({
    key: `no-show-recap:${meeting.id}:${email}`,
    kind: "no_show_recap" as const,
    meetingId: meeting.id,
    payload: { meetingId: meeting.id, ownerUserId: meeting.userId, email },
  }));
}

/** Effect handler for a ledger "no_show_recap" entry. */
export async function sendNoShowRecapEffect(effect: {
  effectKey: string;
  payload: Record<string, unknown>;
}): Promise<EffectResult> {
  const { meetingId, ownerUserId, email } = effect.payload as {
    meetingId: string;
    ownerUserId: string;
    email: string;
  };
  await sendMeetingRecapEmail(meetingId, ownerUserId, email, true, stableMessageId(effect.effectKey));
  return { status: "succeeded" };
}
