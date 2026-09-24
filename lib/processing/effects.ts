import { createHash, randomUUID } from "crypto";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { outboundEffects, type OutboundEffectKind } from "@/db/schema";

/**
 * Delivery ledger for outbound side effects (webhooks, Slack, email).
 *
 * Each logical effect has a stable `key`. Enqueueing is insert-or-ignore on
 * that key, so re-running analysis or an overlapping cron run finds the
 * existing row instead of creating a second delivery. Sending requires a
 * claim: a conditional update that only one worker can win, and which a
 * later worker can take over only once the claim's lease has expired.
 *
 * Guarantee: at-least-once, deduplicated by key. A completed ("succeeded")
 * effect is never repeated. The one gap no database can close: if a worker
 * dies after the provider accepted the message but before recording it,
 * the effect is re-sent once its lease expires. Handlers pass the stable
 * key to the provider (webhook header, email Message-ID) so receivers can
 * drop that duplicate themselves.
 */
// Longer than any route that dispatches effects can run (analyze: 300s).
export const EFFECT_LEASE_MS = 10 * 60_000;
export const MAX_EFFECT_ATTEMPTS = 5;

const effectLeaseInterval = sql.raw(`interval '${EFFECT_LEASE_MS / 1000} seconds'`);

export interface EffectSpec {
  key: string;
  kind: OutboundEffectKind;
  meetingId: string | null;
  payload: Record<string, unknown>;
}

export type OutboundEffect = typeof outboundEffects.$inferSelect;

export type EffectResult =
  | { status: "succeeded" }
  | { status: "failed"; error: string }
  /** Permanently pointless (e.g. the webhook was deleted) — don't retry. */
  | { status: "cancelled"; reason: string };

export type EffectHandler = (effect: OutboundEffect) => Promise<EffectResult>;

/** Insert-or-ignore statement for `specs` — usable inside an atomic batch. */
export function enqueueEffectsQuery(specs: EffectSpec[]) {
  if (specs.length === 0) return null;
  return db
    .insert(outboundEffects)
    .values(
      specs.map((s) => ({
        effectKey: s.key,
        kind: s.kind,
        meetingId: s.meetingId,
        payload: s.payload,
      }))
    )
    .onConflictDoNothing({ target: outboundEffects.effectKey });
}

export async function enqueueEffects(specs: EffectSpec[]): Promise<void> {
  const query = enqueueEffectsQuery(specs);
  if (query) await query;
}

/**
 * Condition for an effect that may be (re)attempted now: never succeeded or
 * cancelled, under the attempt cap, and not held by a live claim. Failed
 * effects back off exponentially (1, 2, 4, 8 min) between attempts.
 */
const claimable = and(
  lt(outboundEffects.attemptCount, MAX_EFFECT_ATTEMPTS),
  or(
    eq(outboundEffects.status, "pending"),
    and(
      eq(outboundEffects.status, "failed"),
      sql`${outboundEffects.claimedAt} < now() - interval '1 minute' * power(2, ${outboundEffects.attemptCount} - 1)`
    ),
    and(
      eq(outboundEffects.status, "sending"),
      sql`${outboundEffects.claimedAt} < now() - ${effectLeaseInterval}`
    )
  )
);

async function claimEffect(effectId: string, claimId: string): Promise<OutboundEffect | null> {
  const [claimed] = await db
    .update(outboundEffects)
    .set({
      status: "sending",
      claimId,
      claimedAt: sql`now()`,
      attemptCount: sql`${outboundEffects.attemptCount} + 1`,
    })
    .where(and(eq(outboundEffects.id, effectId), claimable))
    .returning();
  return claimed ?? null;
}

async function settleEffect(effectId: string, claimId: string, result: EffectResult): Promise<void> {
  const owned = and(eq(outboundEffects.id, effectId), eq(outboundEffects.claimId, claimId));
  if (result.status === "succeeded") {
    await db
      .update(outboundEffects)
      .set({ status: "succeeded", completedAt: sql`now()`, lastError: null })
      .where(owned);
  } else if (result.status === "cancelled") {
    await db
      .update(outboundEffects)
      .set({ status: "cancelled", completedAt: sql`now()`, lastError: result.reason })
      .where(owned);
  } else {
    await db
      .update(outboundEffects)
      .set({ status: "failed", lastError: result.error.slice(0, 2000) })
      .where(owned);
  }
}

/** Claims one effect, runs `handler` on it and records the outcome. Returns null if it couldn't be claimed. */
export async function runEffect(effectId: string, handler: EffectHandler): Promise<EffectResult | null> {
  const claimId = randomUUID();
  const effect = await claimEffect(effectId, claimId);
  if (!effect) return null;

  let result: EffectResult;
  try {
    result = await handler(effect);
  } catch (error) {
    result = { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }

  try {
    await settleEffect(effect.id, claimId, result);
  } catch (error) {
    // The claim lease expires and the effect is retried — at-least-once.
    console.error(`Failed to record outcome of effect ${effect.effectKey}`, error);
  }
  return result;
}

/** Effects that could be attempted now, optionally scoped to one meeting or a set of keys. */
export async function findClaimableEffects(
  scope: { meetingId?: string; keys?: string[] } = {},
  limit = 100
): Promise<OutboundEffect[]> {
  const conditions = [claimable];
  if (scope.meetingId) conditions.push(eq(outboundEffects.meetingId, scope.meetingId));
  if (scope.keys) {
    if (scope.keys.length === 0) return [];
    conditions.push(inArray(outboundEffects.effectKey, scope.keys));
  }
  return db
    .select()
    .from(outboundEffects)
    .where(and(...conditions))
    .orderBy(outboundEffects.createdAt)
    .limit(limit);
}

/**
 * RFC 5322 Message-ID derived from an effect key — identical across every
 * attempt of the same effect, so mail systems that dedupe on Message-ID can
 * drop a retry that follows an unrecorded success. SMTP (Brevo) offers no
 * idempotency key, so this is the strongest dedupe available for email.
 */
export function stableMessageId(effectKey: string): string {
  const digest = createHash("sha256").update(effectKey).digest("hex").slice(0, 40);
  let host = "meetflhow.app";
  try {
    if (process.env.NEXTAUTH_URL) host = new URL(process.env.NEXTAUTH_URL).hostname;
  } catch {
    // keep the default host
  }
  return `<${digest}@${host}>`;
}
