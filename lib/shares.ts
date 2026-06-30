import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { meetingShares } from "@/db/schema";
import type { PublicShareActionItem, PublicSharePayload, ShareLinkView, ShareSettings } from "@/types/share";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function unlockCookieName(token: string): string {
  return `su_${token.slice(0, 12)}`;
}

export function unlockCookieValue(token: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  return createHmac("sha256", secret).update(token).digest("hex");
}

function toShareLinkView(row: typeof meetingShares.$inferSelect): ShareLinkView {
  return {
    id: row.id,
    token: row.token,
    has_password: Boolean(row.passwordHash),
    expires_at: row.expiresAt ? row.expiresAt.toISOString() : null,
    view_count: row.viewCount,
    last_viewed_at: row.lastViewedAt ? row.lastViewedAt.toISOString() : null,
    show_transcript: row.showTranscript,
    show_action_items: row.showActionItems,
    show_cost: row.showCost,
    show_score: row.showScore,
    created_at: row.createdAt.toISOString(),
  };
}

async function findOwnedMeeting(meetingId: string, userId: string) {
  return db.query.meetings.findFirst({
    where: (m, { and, eq }) => and(eq(m.id, meetingId), eq(m.userId, userId)),
  });
}

export async function getShareSettings(
  meetingId: string,
  userId: string
): Promise<ShareLinkView | null> {
  const meeting = await findOwnedMeeting(meetingId, userId);
  if (!meeting) throw new Error("Meeting not found");

  const share = await db.query.meetingShares.findFirst({
    where: (s, { eq }) => eq(s.meetingId, meetingId),
  });
  return share ? toShareLinkView(share) : null;
}

export async function createOrUpdateShare(
  meetingId: string,
  userId: string,
  options: Partial<ShareSettings> & {
    password?: string | null;
    expires_in_days?: number | null;
  }
): Promise<ShareLinkView> {
  const meeting = await findOwnedMeeting(meetingId, userId);
  if (!meeting) throw new Error("Meeting not found");

  const existing = await db.query.meetingShares.findFirst({
    where: (s, { eq }) => eq(s.meetingId, meetingId),
  });

  const expiresAt =
    options.expires_in_days == null
      ? existing?.expiresAt ?? null
      : options.expires_in_days === 0
        ? null
        : new Date(Date.now() + options.expires_in_days * 24 * 60 * 60 * 1000);

  const passwordHash =
    options.password === undefined
      ? existing?.passwordHash ?? null
      : options.password
        ? hashPassword(options.password)
        : null;

  const values = {
    showTranscript: options.show_transcript ?? existing?.showTranscript ?? true,
    showActionItems: options.show_action_items ?? existing?.showActionItems ?? true,
    showCost: options.show_cost ?? existing?.showCost ?? false,
    showScore: options.show_score ?? existing?.showScore ?? true,
    passwordHash,
    expiresAt,
  };

  if (existing) {
    const [updated] = await db
      .update(meetingShares)
      .set(values)
      .where(eq(meetingShares.id, existing.id))
      .returning();
    return toShareLinkView(updated);
  }

  const [created] = await db
    .insert(meetingShares)
    .values({
      meetingId,
      token: randomBytes(24).toString("hex"),
      createdBy: userId,
      ...values,
    })
    .returning();
  return toShareLinkView(created);
}

export async function revokeShare(meetingId: string, userId: string): Promise<void> {
  const meeting = await findOwnedMeeting(meetingId, userId);
  if (!meeting) throw new Error("Meeting not found");
  await db.delete(meetingShares).where(eq(meetingShares.meetingId, meetingId));
}

export async function verifySharePassword(token: string, password: string): Promise<boolean> {
  const share = await db.query.meetingShares.findFirst({
    where: (s, { eq }) => eq(s.token, token),
  });
  if (!share || !share.passwordHash) return false;
  return passwordMatches(password, share.passwordHash);
}

export async function getPublicShare(
  token: string,
  unlocked: boolean
): Promise<{ payload: PublicSharePayload; expired: boolean } | null> {
  const share = await db.query.meetingShares.findFirst({
    where: (s, { eq }) => eq(s.token, token),
  });
  if (!share) return null;

  const expired = Boolean(share.expiresAt && share.expiresAt.getTime() < Date.now());
  const passwordProtected = Boolean(share.passwordHash);

  if (!expired) {
    await db
      .update(meetingShares)
      .set({ viewCount: share.viewCount + 1, lastViewedAt: new Date() })
      .where(eq(meetingShares.id, share.id));
  }

  const meeting = await db.query.meetings.findFirst({
    where: (m, { eq }) => eq(m.id, share.meetingId),
    with: { transcript: true, analysis: true, actionItems: true, user: true },
  });
  if (!meeting) return null;

  const showContent = !expired && (!passwordProtected || unlocked);

  const actionItems: PublicShareActionItem[] | null =
    showContent && share.showActionItems
      ? meeting.actionItems.map((item) => ({
          task: item.task,
          owner: item.owner,
          due_date: item.dueDate,
          priority: item.priority,
        }))
      : null;

  const payload: PublicSharePayload = {
    meeting_title: meeting.title,
    meeting_date: meeting.createdAt.toISOString(),
    platform: meeting.platform,
    duration_seconds: meeting.durationSeconds,
    shared_by_name: meeting.user.name,
    shared_by_image: meeting.user.image,
    password_protected: passwordProtected,
    locked: !expired && passwordProtected && !unlocked,
    show_transcript: share.showTranscript,
    show_action_items: share.showActionItems,
    show_cost: share.showCost,
    show_score: share.showScore,
    summary: showContent ? meeting.analysis?.summary ?? null : null,
    decisions: showContent ? meeting.analysis?.decisions ?? [] : [],
    action_items: actionItems,
    transcript_full_text:
      showContent && share.showTranscript ? meeting.transcript?.fullText ?? null : null,
    transcript_segments:
      showContent && share.showTranscript ? meeting.transcript?.speakerSegments ?? null : null,
    score:
      showContent && share.showScore && meeting.analysis?.meetingScore
        ? {
            overall_score: meeting.analysis.meetingScore.overall_score,
            feedback: meeting.analysis.meetingScore.coach_feedback,
          }
        : null,
  };

  return { payload, expired };
}
