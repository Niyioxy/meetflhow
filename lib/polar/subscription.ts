import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaces, type SubscriptionStatus, type WorkspacePlan } from "@/db/schema";

// The slice of Polar's subscription payload we rely on.
export interface PolarSubscriptionPayload {
  id: string;
  status: string;
  customer_id: string;
  customer?: { external_id?: string | null } | null;
  metadata?: Record<string, string | number | boolean> | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function planForPolarStatus(status: string): {
  plan: WorkspacePlan;
  subscriptionStatus: SubscriptionStatus;
  entitled: boolean;
} {
  // past_due keeps access while Polar retries the card, same grace the old
  // billing flow gave.
  if (status === "active" || status === "trialing") {
    return { plan: "team", subscriptionStatus: "active", entitled: true };
  }
  if (status === "past_due") {
    return { plan: "team", subscriptionStatus: "past_due", entitled: true };
  }
  // canceled / unpaid / paused / incomplete / incomplete_expired
  return { plan: "free", subscriptionStatus: "canceled", entitled: false };
}

function workspaceIdFor(sub: PolarSubscriptionPayload): string | null {
  const candidate = sub.customer?.external_id ?? sub.metadata?.workspaceId;
  return typeof candidate === "string" && UUID_RE.test(candidate) ? candidate : null;
}

/**
 * Sets the workspace's plan from a Polar subscription payload. Every event
 * carries the full current subscription, so applying one is idempotent and a
 * redelivered webhook is harmless.
 */
export async function applyPolarSubscription(sub: PolarSubscriptionPayload): Promise<"applied" | "ignored"> {
  const workspaceId = workspaceIdFor(sub);
  if (!workspaceId) return "ignored";

  const [workspace] = await db
    .select({ id: workspaces.id, billingSubscriptionId: workspaces.billingSubscriptionId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!workspace) return "ignored";

  const next = planForPolarStatus(sub.status);

  // A non-entitling event for a subscription we aren't tracking is stale or
  // pre-payment (e.g. the old subscription being revoked after the workspace
  // re-subscribed, or a brand-new one still `incomplete`). It must not
  // downgrade the workspace's current plan.
  if (!next.entitled && workspace.billingSubscriptionId !== sub.id) return "ignored";

  await db
    .update(workspaces)
    .set({
      plan: next.plan,
      subscriptionStatus: next.subscriptionStatus,
      billingCustomerId: sub.customer_id,
      // Kept after cancellation so the customer portal (invoices) still opens.
      billingSubscriptionId: sub.id,
    })
    .where(eq(workspaces.id, workspaceId));
  return "applied";
}
