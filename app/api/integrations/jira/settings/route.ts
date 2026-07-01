import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { issueTrackerIntegrations } from "@/db/schema";
import { getWorkspaceMember, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { IssueTrackerIntegrationView } from "@/types/issue-tracker";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });

  try {
    await getWorkspaceMember(session.user.id, workspaceId);
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  const row = await db.query.issueTrackerIntegrations.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "jira")),
  });

  const view: IssueTrackerIntegrationView = {
    provider: "jira",
    connected: Boolean(row),
    site_name: row?.siteName ?? null,
    default_project_id: row?.defaultProjectId ?? null,
    default_project_name: row?.defaultProjectName ?? null,
  };
  return NextResponse.json({ jira: view });
}

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  defaultProjectId: z.string().nullable(),
  defaultProjectName: z.string().nullable(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { workspaceId, defaultProjectId, defaultProjectName } = parsed.data;

  try {
    const member = await getWorkspaceMember(session.user.id, workspaceId);
    requireRole(member, "admin");
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  await db
    .update(issueTrackerIntegrations)
    .set({ defaultProjectId, defaultProjectName })
    .where(
      and(
        eq(issueTrackerIntegrations.workspaceId, workspaceId),
        eq(issueTrackerIntegrations.provider, "jira")
      )
    );

  return NextResponse.json({ success: true });
}
