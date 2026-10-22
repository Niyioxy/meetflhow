import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { workspaces } from "@/db/schema";
import { applyPolarSubscription, planForPolarStatus, type PolarSubscriptionPayload } from "@/lib/polar/subscription";
import { canRecordMeeting } from "@/lib/billing";
import { resetDb } from "./helpers/test-db";
import { resetMocks } from "./helpers/mocks";
import { seedUser, seedWorkspace, testDb } from "./helpers/fixtures";

beforeEach(async () => {
  await resetDb();
  resetMocks();
});

function subscription(workspaceId: string, overrides: Partial<PolarSubscriptionPayload> = {}): PolarSubscriptionPayload {
  return {
    id: "sub_1",
    status: "active",
    customer_id: "cus_1",
    customer: { external_id: workspaceId },
    metadata: { workspaceId },
    ...overrides,
  };
}

async function load(workspaceId: string) {
  const db = await testDb();
  const [row] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  return row;
}

async function seed() {
  const user = await seedUser();
  return seedWorkspace(user.id);
}

describe("planForPolarStatus", () => {
  it("grants team access for active, trialing and past_due", () => {
    expect(planForPolarStatus("active")).toMatchObject({ plan: "team", subscriptionStatus: "active" });
    expect(planForPolarStatus("trialing")).toMatchObject({ plan: "team", subscriptionStatus: "active" });
    expect(planForPolarStatus("past_due")).toMatchObject({ plan: "team", subscriptionStatus: "past_due" });
  });

  it("drops to free for every other status", () => {
    for (const status of ["canceled", "unpaid", "paused", "incomplete", "incomplete_expired"]) {
      expect(planForPolarStatus(status)).toMatchObject({ plan: "free", subscriptionStatus: "canceled" });
    }
  });
});

describe("applyPolarSubscription", () => {
  it("upgrades a workspace and stores the Polar IDs", async () => {
    const ws = await seed();

    expect(await applyPolarSubscription(subscription(ws.id))).toBe("applied");

    const row = await load(ws.id);
    expect(row).toMatchObject({
      plan: "team",
      subscriptionStatus: "active",
      billingCustomerId: "cus_1",
      billingSubscriptionId: "sub_1",
    });
    expect(await canRecordMeeting({ id: ws.id, plan: row.plan })).toBe(true);
  });

  it("is idempotent when the same event is redelivered", async () => {
    const ws = await seed();
    await applyPolarSubscription(subscription(ws.id));
    await applyPolarSubscription(subscription(ws.id));

    expect(await load(ws.id)).toMatchObject({ plan: "team", billingSubscriptionId: "sub_1" });
  });

  it("keeps team access while past_due, then downgrades on revocation", async () => {
    const ws = await seed();
    await applyPolarSubscription(subscription(ws.id));

    await applyPolarSubscription(subscription(ws.id, { status: "past_due" }));
    expect(await load(ws.id)).toMatchObject({ plan: "team", subscriptionStatus: "past_due" });

    await applyPolarSubscription(subscription(ws.id, { status: "canceled" }));
    const row = await load(ws.id);
    expect(row).toMatchObject({ plan: "free", subscriptionStatus: "canceled" });
    // Kept so the customer portal (invoices) still opens after cancelling.
    expect(row.billingSubscriptionId).toBe("sub_1");
  });

  it("does not downgrade when an old subscription is revoked after re-subscribing", async () => {
    const ws = await seed();
    await applyPolarSubscription(subscription(ws.id, { id: "sub_old" }));
    await applyPolarSubscription(subscription(ws.id, { id: "sub_new" }));

    expect(await applyPolarSubscription(subscription(ws.id, { id: "sub_old", status: "canceled" }))).toBe("ignored");

    expect(await load(ws.id)).toMatchObject({ plan: "team", billingSubscriptionId: "sub_new" });
  });

  it("ignores a not-yet-paid subscription on a workspace with no subscription", async () => {
    const ws = await seed();

    expect(await applyPolarSubscription(subscription(ws.id, { status: "incomplete" }))).toBe("ignored");

    expect(await load(ws.id)).toMatchObject({ plan: "free", billingSubscriptionId: null });
  });

  it("falls back to metadata when the customer has no external ID", async () => {
    const ws = await seed();

    await applyPolarSubscription(subscription(ws.id, { customer: { external_id: null } }));

    expect((await load(ws.id)).plan).toBe("team");
  });

  it("ignores payloads that don't resolve to a real workspace", async () => {
    await seed();

    expect(await applyPolarSubscription(subscription("not-a-uuid"))).toBe("ignored");
    expect(await applyPolarSubscription(subscription(randomUUID()))).toBe("ignored");
  });
});
