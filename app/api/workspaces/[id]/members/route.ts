import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceDetail } from "@/lib/workspaces";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspace = await getWorkspaceDetail(params.id, session.user.id);
    return NextResponse.json({ members: workspace.members });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
