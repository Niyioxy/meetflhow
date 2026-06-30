import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { deleteComment, updateComment } from "@/lib/comments";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

const bodySchema = z.object({ comment: z.string().trim().min(1) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Comment text is required" }, { status: 400 });
  }

  try {
    await updateComment(params.id, session.user.id, parsed.data.comment);
    return NextResponse.json({ success: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteComment(params.id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
