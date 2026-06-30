import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { addReply, listReplies } from "@/lib/comments";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

const bodySchema = z.object({ reply: z.string().trim().min(1) });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const replies = await listReplies(params.id, session.user.id);
    return NextResponse.json({ replies });
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
    return NextResponse.json({ error: "Reply text is required" }, { status: 400 });
  }

  try {
    const reply = await addReply(params.id, session.user.id, parsed.data.reply);
    return NextResponse.json({ reply }, { status: 201 });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
