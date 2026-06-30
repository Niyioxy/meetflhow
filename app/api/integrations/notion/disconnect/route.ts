import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { notionIntegrations } from "@/db/schema";
import { getWorkspaceMember, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { eq } from "drizzle-orm";

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    const member = await getWorkspaceMember(session.user.id, workspaceId);
    requireRole(member, "admin");
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  await db.delete(notionIntegrations).where(eq(notionIntegrations.workspaceId, workspaceId));

  return NextResponse.json({ success: true });
}
