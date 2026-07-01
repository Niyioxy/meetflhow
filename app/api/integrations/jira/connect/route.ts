import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceMember, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { getJiraAuthorizeUrl } from "@/lib/integrations/jira";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });

  try {
    const member = await getWorkspaceMember(session.user.id, workspaceId);
    requireRole(member, "admin");
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  if (!process.env.JIRA_CLIENT_ID) {
    return NextResponse.json({ error: "Jira is not configured on this server yet" }, { status: 503 });
  }

  return NextResponse.redirect(getJiraAuthorizeUrl(workspaceId));
}
