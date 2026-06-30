import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";
import { listNotionDatabases } from "@/lib/integrations/notion";
import { decrypt } from "@/lib/crypto";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    await getWorkspaceMember(session.user.id, workspaceId);
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  const integration = await db.query.notionIntegrations.findFirst({
    where: (n, { eq }) => eq(n.workspaceId, workspaceId),
  });
  if (!integration) {
    return NextResponse.json({ error: "Notion is not connected for this workspace" }, { status: 404 });
  }

  try {
    const databases = await listNotionDatabases(decrypt(integration.accessToken));
    return NextResponse.json({ databases });
  } catch (error) {
    console.error("Failed to list Notion databases", error);
    return NextResponse.json({ error: "Failed to list Notion databases" }, { status: 502 });
  }
}
