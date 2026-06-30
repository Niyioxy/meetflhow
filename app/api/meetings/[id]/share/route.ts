import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createOrUpdateShare, getShareSettings, revokeShare } from "@/lib/shares";

const bodySchema = z.object({
  password: z.string().min(1).nullable().optional(),
  expires_in_days: z.union([z.literal(7), z.literal(30), z.literal(0)]).nullable().optional(),
  show_transcript: z.boolean().optional(),
  show_action_items: z.boolean().optional(),
  show_cost: z.boolean().optional(),
  show_score: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const share = await getShareSettings(params.id, session.user.id);
    return NextResponse.json({ share });
  } catch {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const share = await createOrUpdateShare(params.id, session.user.id, parsed.data);
    return NextResponse.json({ share });
  } catch {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await revokeShare(params.id, session.user.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
}
