import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";
import { getMonthlyRecordingCount, FREE_TIER_MONTHLY_RECORDINGS } from "@/lib/billing";

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

  const count = await getMonthlyRecordingCount(workspaceId);
  return NextResponse.json({ count, cap: FREE_TIER_MONTHLY_RECORDINGS });
}
