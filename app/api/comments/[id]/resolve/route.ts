import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleResolveComment } from "@/lib/comments";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const resolved = await toggleResolveComment(params.id, session.user.id);
    return NextResponse.json({ resolved });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
