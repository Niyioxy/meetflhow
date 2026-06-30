import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { acceptInvite } from "@/lib/workspaces";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspace = await acceptInvite(params.token, session.user.id, session.user.email);
    return NextResponse.json({ workspace });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
