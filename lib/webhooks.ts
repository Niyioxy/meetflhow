import crypto from "crypto";
import { db } from "@/db";
import { webhooks, webhookLogs, type WebhookEvent } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildSamplePayload, isValidWebhookUrl } from "@/lib/webhooks-shared";
import type { EffectResult, EffectSpec } from "@/lib/processing/effects";

export { buildSamplePayload, isValidWebhookUrl };

const DELIVERY_TIMEOUT_MS = 8000;

function sign(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function deliver(
  webhook: typeof webhooks.$inferSelect,
  event: WebhookEvent,
  payload: object,
  idempotencyKey?: string
) {
  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
  let responseStatus: number | null = null;
  let success = false;

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MeetFlhow-Signature": `sha256=${sign(webhook.secret, body)}`,
        "X-MeetFlhow-Event": event,
        // Stable across retries of the same logical delivery, so receivers
        // can discard a duplicate.
        ...(idempotencyKey ? { "X-MeetFlhow-Delivery-Id": idempotencyKey } : {}),
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    responseStatus = res.status;
    success = res.ok;
  } catch (error) {
    console.error(`Webhook delivery failed for ${webhook.id}`, error);
  }

  await Promise.all([
    db.insert(webhookLogs).values({
      webhookId: webhook.id,
      event,
      payload,
      responseStatus,
      success,
    }),
    db
      .update(webhooks)
      .set({ lastTriggeredAt: new Date(), lastStatus: success ? "success" : "failed" })
      .where(eq(webhooks.id, webhook.id)),
  ]);

  return { success, responseStatus };
}

async function listSubscribedWebhooks(workspaceId: string, event: WebhookEvent) {
  const matches = await db.query.webhooks.findMany({
    where: (w, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(w.workspaceId, workspaceId), eqOp(w.isActive, true)),
  });
  return matches.filter((w) => w.events.includes(event));
}

/**
 * Delivers `event` to every active webhook in `workspaceId` subscribed to it.
 * Never throws — delivery errors are caught and logged per-webhook so a
 * broken third-party endpoint can never fail the calling request.
 * Fire-and-forget: for events the processing pipeline may emit more than
 * once, use webhookEffects instead so each delivery happens once.
 */
export async function triggerWebhooks(
  workspaceId: string | null | undefined,
  event: WebhookEvent,
  payload: object
): Promise<void> {
  if (!workspaceId) return;

  try {
    const subscribed = await listSubscribedWebhooks(workspaceId, event);
    await Promise.all(subscribed.map((w) => deliver(w, event, payload).catch(() => null)));
  } catch (error) {
    console.error("triggerWebhooks failed", error);
  }
}

/**
 * Ledger entries (lib/processing/effects.ts) delivering `event` once per
 * subject — e.g. per action item — to each subscribed webhook. Keys are
 * stable, so enqueueing the same subject again is a no-op.
 */
export async function webhookEffects(
  workspaceId: string | null | undefined,
  meetingId: string,
  event: WebhookEvent,
  subjects: { key: string; data: Record<string, unknown> }[]
): Promise<EffectSpec[]> {
  if (!workspaceId || subjects.length === 0) return [];
  const subscribed = await listSubscribedWebhooks(workspaceId, event);
  return subscribed.flatMap((w) =>
    subjects.map((subject) => ({
      key: `webhook:${event}:${subject.key}:${w.id}`,
      kind: "webhook" as const,
      meetingId,
      payload: { webhookId: w.id, event, data: subject.data },
    }))
  );
}

/** Effect handler for a ledger "webhook" entry. */
export async function deliverWebhookEffect(effect: {
  effectKey: string;
  payload: Record<string, unknown>;
}): Promise<EffectResult> {
  const { webhookId, event, data } = effect.payload as {
    webhookId: string;
    event: WebhookEvent;
    data: object;
  };
  const webhook = await db.query.webhooks.findFirst({ where: (w, { eq: eqOp }) => eqOp(w.id, webhookId) });
  if (!webhook || !webhook.isActive) {
    return { status: "cancelled", reason: "Webhook was deleted or deactivated" };
  }
  const { success, responseStatus } = await deliver(webhook, event, data, effect.effectKey);
  return success
    ? { status: "succeeded" }
    : { status: "failed", error: `Endpoint responded ${responseStatus ?? "with no response"}` };
}

/** Re-sends a sample payload through the same delivery path, for the "Send Test" button. */
export async function sendTestWebhook(webhookId: string, workspaceId: string) {
  const webhook = await db.query.webhooks.findFirst({
    where: (w, { and: andOp, eq: eqOp }) => andOp(eqOp(w.id, webhookId), eqOp(w.workspaceId, workspaceId)),
  });
  if (!webhook) return null;

  const event = webhook.events[0] ?? "meeting.completed";
  const { success } = await deliver(webhook, event, buildSamplePayload(event));
  return { event, success };
}
