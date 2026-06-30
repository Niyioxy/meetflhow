import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";
import { listSlackChannels } from "@/lib/integrations/slack";
import { decrypt } from "@/lib/crypto";
import type { SlackChannelView } from "@/types/slack";

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

  const integration = await db.query.slackIntegrations.findFirst({
    where: (s, { eq }) => eq(s.workspaceId, workspaceId),
  });
  if (!integration) {
    return NextResponse.json({ error: "Slack is not connected for this workspace" }, { status: 404 });
  }

  try {
    const channels = await listSlackChannels(decrypt(integration.accessToken));
    const view: SlackChannelView[] = channels;
    return NextResponse.json({ channels: view });
  } catch (error) {
    console.error("Failed to list Slack channels", error);
    return NextResponse.json({ error: "Failed to list Slack channels" }, { status: 502 });
  }
}
