import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMeetingDetail, runSermonCoach } from "@/lib/meetings";

export const runtime = "nodejs";
// Long sermon transcripts with reasoning can take a while to coach.
export const maxDuration = 120;

/**
 * Private preaching feedback. Only the meeting's owner may see it — workspace
 * members who can open a shared sermon don't get its coaching, and it never
 * appears in public shares. Others get a 404, not a 403, so the endpoint
 * doesn't confirm a coach exists.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await getMeetingDetail(params.id, session.user.id);
  if (!meeting || meeting.userId !== session.user.id) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  if (meeting.contentType !== "sermon") {
    return NextResponse.json({ error: "Sermon Coach is only available for sermons" }, { status: 400 });
  }
  if (!meeting.transcript) {
    return NextResponse.json({ error: "Meeting has no transcript yet" }, { status: 400 });
  }

  try {
    const sermonCoach = await runSermonCoach(meeting.id);
    return NextResponse.json({ sermonCoach });
  } catch (error) {
    console.error("Sermon coach analysis failed", error);
    return NextResponse.json({ error: "Failed to generate sermon coaching" }, { status: 500 });
  }
}
