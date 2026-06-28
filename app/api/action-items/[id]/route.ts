import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { actionItems, actionItemStatusEnum } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  status: z.enum(actionItemStatusEnum),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const item = await db.query.actionItems.findFirst({
    where: (a, { eq }) => eq(a.id, params.id),
    with: { meeting: true },
  });

  if (!item || item.meeting.userId !== session.user.id) {
    return NextResponse.json({ error: "Action item not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(actionItems)
    .set({ status: parsed.data.status })
    .where(and(eq(actionItems.id, params.id), eq(actionItems.meetingId, item.meetingId)))
    .returning();

  return NextResponse.json({ actionItem: updated });
}
