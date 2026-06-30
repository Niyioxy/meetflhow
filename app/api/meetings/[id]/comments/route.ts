import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createComment, listComments } from "@/lib/comments";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

const bodySchema = z.object({
  segment_index: z.number().int().min(0),
  selected_text: z.string().min(1),
  comment: z.string().trim().min(1),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const comments = await listComments(params.id, session.user.id);
    return NextResponse.json({ comments });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const comment = await createComment(params.id, session.user.id, parsed.data);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
