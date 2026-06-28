import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { getMeetingDetail, runSpeakerIdentification } from "@/lib/meetings";

const bodySchema = z.object({
  attendees: z.array(z.string()).default([]),
});

export async function POST(
  req: Request,
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

  const json = await req.json().catch(() => ({}));
  const { attendees } = bodySchema.parse(json ?? {});

  try {
    const speakerSegments = await runSpeakerIdentification(
      meeting.id,
      meeting.transcript.fullText,
      attendees
    );
    return NextResponse.json({ speakerSegments });
  } catch (error) {
    console.error("Speaker identification failed", error);
    return NextResponse.json(
      { error: "Failed to identify speakers" },
      { status: 500 }
    );
  }
}
