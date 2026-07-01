import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";
import { listJiraProjects } from "@/lib/integrations/jira";

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

  const integration = await db.query.issueTrackerIntegrations.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "jira")),
  });
  if (!integration) return NextResponse.json({ error: "Jira is not connected" }, { status: 404 });

  try {
    const projects = await listJiraProjects(workspaceId, integration.siteUrl!);
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to list Jira projects", error);
    return NextResponse.json({ error: "Failed to list Jira projects" }, { status: 502 });
  }
}
