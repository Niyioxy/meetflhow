import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureTranscriptOwnership, runMeetingCostAnalysis } from "@/lib/meetings";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await ensureTranscriptOwnership(params.id, session.user.id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  try {
    const calculatedCost = await runMeetingCostAnalysis(meeting.id);
    return NextResponse.json({ calculatedCost });
  } catch (error) {
    console.error("Cost calculation failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to calculate cost" },
      { status: 400 }
    );
  }
}
