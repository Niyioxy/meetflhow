import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { issueTrackerIntegrations } from "@/db/schema";
import { getWorkspaceMember, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { eq, and } from "drizzle-orm";

export async function DELETE(req: Request) {
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

  await db
    .delete(issueTrackerIntegrations)
    .where(
      and(
        eq(issueTrackerIntegrations.workspaceId, workspaceId),
        eq(issueTrackerIntegrations.provider, "linear")
      )
    );

  return NextResponse.json({ success: true });
}
