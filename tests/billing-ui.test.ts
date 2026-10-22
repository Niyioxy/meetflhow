import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { isBillingConfigured, PLAN_LIMIT_CODE, FREE_TIER_MONTHLY_RECORDINGS } from "@/lib/billing";
import { apiError, PlanLimitError } from "@/lib/plan-limit-client";
import { webUploadPrefix } from "@/lib/blob-urls";
import { resetDb } from "./helpers/test-db";
import { resetMocks } from "./helpers/mocks";
import { seedMeeting, seedUser, seedWorkspace, testDb } from "./helpers/fixtures";

const authMock = vi.hoisted(() => vi.fn());
const polarCreate = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/polar/client", () => ({ getPolarClient: () => ({ checkouts: { create: polarCreate } }) }));

import { GET as usageRoute } from "@/app/api/billing/usage/route";
import { POST as checkoutRoute } from "@/app/api/billing/checkout/route";
import { POST as uploadRoute } from "@/app/api/meetings/upload/route";

const ENV_KEYS = ["POLAR_ACCESS_TOKEN", "POLAR_PRODUCT_ID_TEAM_MONTHLY"] as const;

function configureBilling(on: boolean) {
  for (const key of ENV_KEYS) {
    if (on) process.env[key] = `test-${key}`;
    else delete process.env[key];
  }
}

async function seedOwnedWorkspace() {
  const user = await seedUser();
  const workspace = await seedWorkspace(user.id);
  const db = await testDb();
  await db.insert(schema.workspaceMembers).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
  authMock.mockResolvedValue({ user: { id: user.id, email: "owner@example.com" } });
  return { user, workspace };
}

beforeEach(async () => {
  await resetDb();
  resetMocks();
  authMock.mockReset();
  polarCreate.mockReset();
  polarCreate.mockResolvedValue({ url: "https://polar.test/checkout/abc" });
  configureBilling(false);
});

afterEach(() => configureBilling(false));

describe("isBillingConfigured", () => {
  it("needs both the Polar token and the product id", () => {
    expect(isBillingConfigured()).toBe(false);
    process.env.POLAR_ACCESS_TOKEN = "t";
    expect(isBillingConfigured()).toBe(false);
    process.env.POLAR_PRODUCT_ID_TEAM_MONTHLY = "p";
    expect(isBillingConfigured()).toBe(true);
  });
});

describe("GET /api/billing/usage", () => {
  const call = (workspaceId: string) =>
    usageRoute(new Request(`https://app.test/api/billing/usage?workspaceId=${workspaceId}`));

  it("tells the UI whether paying is possible on this server", async () => {
    const { workspace } = await seedOwnedWorkspace();

    expect((await (await call(workspace.id)).json()).billing_enabled).toBe(false);

    configureBilling(true);
    const body = await (await call(workspace.id)).json();
    expect(body).toEqual({ count: 0, cap: FREE_TIER_MONTHLY_RECORDINGS, billing_enabled: true });
  });
});

describe("POST /api/billing/checkout", () => {
  const call = (workspaceId: string) =>
    checkoutRoute(
      new Request("https://app.test/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      })
    );

  it("says plainly when billing isn't set up, and never calls Polar", async () => {
    const { workspace } = await seedOwnedWorkspace();

    const res = await call(workspace.id);

    expect(res.status).toBe(503);
    expect(polarCreate).not.toHaveBeenCalled();
  });

  it("starts a checkout that returns to the billing page", async () => {
    configureBilling(true);
    const { workspace } = await seedOwnedWorkspace();

    const res = await call(workspace.id);

    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe("https://polar.test/checkout/abc");
    expect(polarCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        external_customer_id: workspace.id,
        success_url: "https://app.test/billing?billing=success",
        return_url: "https://app.test/billing?billing=cancelled",
      })
    );
  });
});

describe("free plan limit", () => {
  it("is reported with a code the UI turns into an Upgrade button", async () => {
    const { user, workspace } = await seedOwnedWorkspace();
    for (let i = 0; i < FREE_TIER_MONTHLY_RECORDINGS; i++) {
      await seedMeeting({ userId: user.id, workspaceId: workspace.id, status: "ready" });
    }

    const res = await uploadRoute(
      new Request("https://app.test/api/meetings/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl: `https://s1.public.blob.vercel-storage.com/${webUploadPrefix(user.id)}1-a.webm`,
          workspaceId: workspace.id,
        }),
      })
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe(PLAN_LIMIT_CODE);
    expect(body.error).toMatch(/upgrade to Team/i);
  });

  it("is told apart from other errors on the client", () => {
    expect(apiError({ error: "Free plan limit reached", code: "plan_limit" }, "x")).toBeInstanceOf(PlanLimitError);
    expect(apiError({ error: "Something else" }, "x")).not.toBeInstanceOf(PlanLimitError);
    expect(apiError(null, "Upload failed").message).toBe("Upload failed");
  });
});
