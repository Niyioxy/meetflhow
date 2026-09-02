import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMeetingDetail, runVerticalContent } from "@/lib/meetings";

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
  if (meeting.contentType !== "sermon" && meeting.contentType !== "podcast") {
    return NextResponse.json(
      { error: "Vertical content is only available for sermons and podcasts" },
      { status: 400 }
    );
  }

  try {
    const verticalContent = await runVerticalContent(
      meeting.id,
      meeting.transcript.fullText,
      meeting.contentType
    );
    return NextResponse.json({ verticalContent });
  } catch (error) {
    console.error("Vertical content generation failed", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
