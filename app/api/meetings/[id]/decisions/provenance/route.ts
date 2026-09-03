import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getMeetingDetail } from "@/lib/meetings";
import { findDecisionProvenance } from "@/lib/search/decision-provenance";

const bodySchema = z.object({
  decisionText: z.string().min(1).max(2000),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await getMeetingDetail(params.id, session.user.id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await findDecisionProvenance(
      parsed.data.decisionText,
      meeting.id,
      meeting.createdAt,
      session.user.id
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Decision provenance failed", error);
    return NextResponse.json({ error: "Failed to trace this decision" }, { status: 500 });
  }
}
