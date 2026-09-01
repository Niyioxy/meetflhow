import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetings, contentTypeEnum } from "@/db/schema";
import { getMeetingDetail } from "@/lib/meetings";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await getMeetingDetail(params.id, session.user.id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json({ meeting });
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  platform: z.string().optional(),
  contentType: z.enum(contentTypeEnum).optional(),
  sharedWithWorkspace: z.boolean().optional(),
});

/**
 * Updates title/platform/contentType/sharing on a meeting the caller owns.
 * Used by the recorder to let someone edit those details after the
 * recording has already been auto-saved and started processing (see
 * components/record/recorder.tsx) — the meeting exists the instant
 * recording stops, so this only ever adjusts metadata, never creates it.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.query.meetings.findFirst({
    where: (m, { and, eq }) => and(eq(m.id, params.id), eq(m.userId, session.user.id)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ meeting: existing });
  }

  const [updated] = await db
    .update(meetings)
    .set(parsed.data)
    .where(eq(meetings.id, params.id))
    .returning();

  return NextResponse.json({ meeting: updated });
}
