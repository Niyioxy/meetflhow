import crypto from "crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as polarWebhook } from "@/app/api/webhooks/polar/route";
import { workspaces } from "@/db/schema";
import { resetDb } from "./helpers/test-db";
import { resetMocks } from "./helpers/mocks";
import { seedUser, seedWorkspace, testDb } from "./helpers/fixtures";

// Polar signs deliveries per the Standard Webhooks spec: HMAC-SHA256 over
// "<webhook-id>.<timestamp>.<raw body>", sent in the webhook-* headers.
const SECRET = "polar_whs_test_secret_value";

function signed(body: object, options: { secret?: string; timestamp?: number; tamper?: boolean } = {}) {
  const raw = JSON.stringify(body);
  const id = `evt_${crypto.randomUUID()}`;
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", options.secret ?? SECRET)
    .update(`${id}.${timestamp}.${raw}`)
    .digest("base64");
  return new Request("https://app.test/api/webhooks/polar", {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(timestamp),
      "webhook-signature": `v1,${signature}`,
    },
    body: options.tamper ? raw.replace("active", "canceled") : raw,
  });
}

function subscriptionEvent(workspaceId: string, status = "active", type = "subscription.active") {
  return {
    type,
    timestamp: new Date().toISOString(),
    data: { id: "sub_1", status, customer_id: "cus_1", customer: { external_id: workspaceId }, metadata: {} },
  };
}

async function planOf(workspaceId: string) {
  const db = await testDb();
  const [row] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  return row.plan;
}

beforeEach(async () => {
  await resetDb();
  resetMocks();
  process.env.POLAR_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.POLAR_WEBHOOK_SECRET;
});

async function seedWs() {
  const user = await seedUser();
  return seedWorkspace(user.id);
}

describe("POST /api/webhooks/polar", () => {
  it("upgrades the workspace on a correctly signed subscription event", async () => {
    const ws = await seedWs();

    const res = await polarWebhook(signed(subscriptionEvent(ws.id)));

    expect(res.status).toBe(200);
    expect(await planOf(ws.id)).toBe("team");
  });

  it("downgrades when the subscription is revoked", async () => {
    const ws = await seedWs();
    await polarWebhook(signed(subscriptionEvent(ws.id)));

    const res = await polarWebhook(signed(subscriptionEvent(ws.id, "canceled", "subscription.revoked")));

    expect(res.status).toBe(200);
    expect(await planOf(ws.id)).toBe("free");
  });

  it("rejects a wrong secret, a tampered body and a stale timestamp, changing nothing", async () => {
    const ws = await seedWs();
    const event = subscriptionEvent(ws.id);

    const wrongSecret = await polarWebhook(signed(event, { secret: "someone-elses-secret" }));
    const tampered = await polarWebhook(signed(event, { tamper: true }));
    const stale = await polarWebhook(signed(event, { timestamp: Math.floor(Date.now() / 1000) - 3600 }));

    expect([wrongSecret.status, tampered.status, stale.status]).toEqual([403, 403, 403]);
    expect(await planOf(ws.id)).toBe("free");
  });

  it("acknowledges event types it doesn't use, so Polar never retries or disables the endpoint", async () => {
    const ws = await seedWs();

    const unknown = await polarWebhook(signed({ type: "some.future_event", data: { anything: true } }));
    const known = await polarWebhook(signed({ type: "order.paid", data: { id: "ord_1" } }));

    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(await planOf(ws.id)).toBe("free");
  });

  it("answers 400 when it has no secret configured", async () => {
    delete process.env.POLAR_WEBHOOK_SECRET;

    expect((await polarWebhook(signed({ type: "order.paid" }))).status).toBe(400);
  });
});
