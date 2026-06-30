import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { mentionContextTypeEnum } from "@/db/schema";
import { createMentionsForContent, listMentionsForUser } from "@/lib/mentions";

const bodySchema = z.object({
  workspace_id: z.string().uuid().nullable(),
  context_type: z.enum(mentionContextTypeEnum),
  context_id: z.string().uuid(),
  context_text: z.string(),
  meeting_id: z.string().uuid().nullable().optional(),
  text: z.string(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mentions = await listMentionsForUser(session.user.id);
  return NextResponse.json({ mentions });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await createMentionsForContent({
    fromUserId: session.user.id,
    workspaceId: parsed.data.workspace_id,
    contextType: parsed.data.context_type,
    contextId: parsed.data.context_id,
    contextText: parsed.data.context_text,
    meetingId: parsed.data.meeting_id ?? null,
    text: parsed.data.text,
  });

  return NextResponse.json({ success: true });
}
