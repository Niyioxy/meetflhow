import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { slackIntegrations, slackPostSettings } from "@/db/schema";
import { getWorkspaceMember, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { SlackIntegrationView } from "@/types/slack";

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
  const settings = await db.query.slackPostSettings.findFirst({
    where: (s, { eq }) => eq(s.workspaceId, workspaceId),
  });

  const view: SlackIntegrationView = {
    connected: Boolean(integration),
    team_name: integration?.slackTeamName ?? null,
    default_channel_id: settings?.channelId ?? integration?.defaultChannelId ?? null,
    default_channel_name: settings?.channelName ?? integration?.defaultChannelName ?? null,
    auto_post_summary: settings?.autoPostSummary ?? true,
    auto_post_action_items: settings?.autoPostActionItems ?? true,
  };

  return NextResponse.json({ slack: view });
}

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  channelId: z.string().nullable().optional(),
  channelName: z.string().nullable().optional(),
  autoPostSummary: z.boolean().optional(),
  autoPostActionItems: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { workspaceId, channelId, channelName, autoPostSummary, autoPostActionItems } = parsed.data;

  try {
    const member = await getWorkspaceMember(session.user.id, workspaceId);
    requireRole(member, "admin");
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  const existing = await db.query.slackPostSettings.findFirst({
    where: (s, { eq }) => eq(s.workspaceId, workspaceId),
  });

  const updates: Partial<typeof slackPostSettings.$inferInsert> = {};
  if (channelId !== undefined) updates.channelId = channelId;
  if (channelName !== undefined) updates.channelName = channelName;
  if (autoPostSummary !== undefined) updates.autoPostSummary = autoPostSummary;
  if (autoPostActionItems !== undefined) updates.autoPostActionItems = autoPostActionItems;

  if (existing) {
    await db.update(slackPostSettings).set(updates).where(eq(slackPostSettings.workspaceId, workspaceId));
  } else {
    await db.insert(slackPostSettings).values({ workspaceId, ...updates });
  }

  if (channelId !== undefined || channelName !== undefined) {
    await db
      .update(slackIntegrations)
      .set({ defaultChannelId: channelId, defaultChannelName: channelName })
      .where(eq(slackIntegrations.workspaceId, workspaceId));
  }

  return NextResponse.json({ success: true });
}
