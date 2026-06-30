import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { notionIntegrations } from "@/db/schema";
import { getWorkspaceMember, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { NotionIntegrationView } from "@/types/notion";

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

  const view: NotionIntegrationView = {
    connected: Boolean(integration),
    workspace_name: integration?.notionWorkspaceName ?? null,
    workspace_icon: integration?.notionWorkspaceIcon ?? null,
    database_id: integration?.databaseId ?? null,
    database_name: integration?.databaseName ?? null,
  };

  return NextResponse.json({ notion: view });
}

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  databaseId: z.string().nullable(),
  databaseName: z.string().nullable(),
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
  const { workspaceId, databaseId, databaseName } = parsed.data;

  try {
    const member = await getWorkspaceMember(session.user.id, workspaceId);
    requireRole(member, "admin");
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  await db
    .update(notionIntegrations)
    .set({ databaseId, databaseName })
    .where(eq(notionIntegrations.workspaceId, workspaceId));

  return NextResponse.json({ success: true });
}
