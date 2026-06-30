import crypto from "crypto";
import { db } from "@/db";
import { webhooks, webhookLogs, type WebhookEvent } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildSamplePayload, isValidWebhookUrl } from "@/lib/webhooks-shared";

export { buildSamplePayload, isValidWebhookUrl };

const DELIVERY_TIMEOUT_MS = 8000;

function sign(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

async function deliver(webhook: typeof webhooks.$inferSelect, event: WebhookEvent, payload: object) {
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

  return success;
}

/**
 * Delivers `event` to every active webhook in `workspaceId` subscribed to it.
 * Never throws — delivery errors are caught and logged per-webhook so a
 * broken third-party endpoint can never fail the calling request.
 */
export async function triggerWebhooks(
  workspaceId: string | null | undefined,
  event: WebhookEvent,
  payload: object
): Promise<void> {
  if (!workspaceId) return;

  try {
    const matches = await db.query.webhooks.findMany({
      where: (w, { and: andOp, eq: eqOp }) =>
        andOp(eqOp(w.workspaceId, workspaceId), eqOp(w.isActive, true)),
    });

    const subscribed = matches.filter((w) => w.events.includes(event));
    await Promise.all(subscribed.map((w) => deliver(w, event, payload).catch(() => false)));
  } catch (error) {
    console.error("triggerWebhooks failed", error);
  }
}

/** Re-sends a sample payload through the same delivery path, for the "Send Test" button. */
export async function sendTestWebhook(webhookId: string, workspaceId: string) {
  const webhook = await db.query.webhooks.findFirst({
    where: (w, { and: andOp, eq: eqOp }) => andOp(eqOp(w.id, webhookId), eqOp(w.workspaceId, workspaceId)),
  });
  if (!webhook) return null;

  const event = webhook.events[0] ?? "meeting.completed";
  const success = await deliver(webhook, event, buildSamplePayload(event));
  return { event, success };
}
