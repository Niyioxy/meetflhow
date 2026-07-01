import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";
import { listLinearTeams } from "@/lib/integrations/linear";

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
    where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "linear")),
  });
  if (!integration) return NextResponse.json({ error: "Linear is not connected" }, { status: 404 });

  try {
    const teams = await listLinearTeams(workspaceId);
    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Failed to list Linear teams", error);
    return NextResponse.json({ error: "Failed to list Linear teams" }, { status: 502 });
  }
}
