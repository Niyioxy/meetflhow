import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { meetings, type WorkspacePlan } from "@/db/schema";

export const FREE_TIER_MONTHLY_RECORDINGS = 5;

/**
 * True when this deployment can actually start a paid checkout. Until the
 * Polar account is set up the app says so instead of offering a button that
 * can only fail.
 */
export function isBillingConfigured(): boolean {
  return Boolean(process.env.POLAR_ACCESS_TOKEN && process.env.POLAR_PRODUCT_ID_TEAM_MONTHLY);
}

/** Machine-readable marker the UI uses to turn the limit error into an Upgrade action. */
export const PLAN_LIMIT_CODE = "plan_limit";

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function getMonthlyRecordingCount(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(meetings)
    .where(and(eq(meetings.workspaceId, workspaceId), gte(meetings.createdAt, startOfMonth())));
  return row?.count ?? 0;
}

/** Personal (no-workspace) recordings are never capped — this only gates workspace-attached ones. */
export async function canRecordMeeting(workspace: { id: string; plan: WorkspacePlan }): Promise<boolean> {
  if (workspace.plan === "team") return true;
  return (await getMonthlyRecordingCount(workspace.id)) < FREE_TIER_MONTHLY_RECORDINGS;
}
