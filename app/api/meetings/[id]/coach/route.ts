import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMeetingDetail, runMeetingCoach } from "@/lib/meetings";

export async function POST(
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
  if (!meeting.transcript) {
    return NextResponse.json(
      { error: "Meeting has no transcript yet" },
      { status: 400 }
    );
  }

  try {
    const meetingScore = await runMeetingCoach(meeting.id, meeting.transcript.fullText);
    return NextResponse.json({ meetingScore });
  } catch (error) {
    console.error("Meeting coach analysis failed", error);
    return NextResponse.json(
      { error: "Failed to generate coach analysis" },
      { status: 500 }
    );
  }
}
