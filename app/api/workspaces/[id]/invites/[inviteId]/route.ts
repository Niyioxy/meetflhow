import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cancelInvite } from "@/lib/workspaces";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; inviteId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await cancelInvite(params.id, session.user.id, params.inviteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
