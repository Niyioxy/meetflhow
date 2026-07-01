import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";

/** Returns which issue-tracker providers are connected for a workspace. */
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

  const rows = await db.query.issueTrackerIntegrations.findMany({
    where: (t, { eq }) => eq(t.workspaceId, workspaceId),
  });

  const connected = rows.map((r) => ({
    provider: r.provider,
    site_name: r.siteName,
    default_project_id: r.defaultProjectId,
    default_project_name: r.defaultProjectName,
  }));

  return NextResponse.json({ connected });
}
