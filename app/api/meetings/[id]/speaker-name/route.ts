import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { db } from "@/db";
import { transcripts } from "@/db/schema";
import { getMeetingDetail } from "@/lib/meetings";
import { eq } from "drizzle-orm";

const bodySchema = z.object({
  oldSpeaker: z.string().min(1),
  newName: z.string().min(1),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await getMeetingDetail(params.id, session.user.id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  if (!meeting.transcript || !meeting.transcript.speakerSegments) {
    return NextResponse.json({ error: "Meeting has no speaker segments yet" }, { status: 400 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { oldSpeaker, newName } = parsed.data;

  const updatedSegments = meeting.transcript.speakerSegments.map((seg) =>
    seg.speaker === oldSpeaker
      ? { ...seg, speaker: newName, identificationMethod: "manual" as const, matchedUserId: null, confidence: null }
      : seg
  );

  await db
    .update(transcripts)
    .set({ speakerSegments: updatedSegments, speakerIdentificationMethod: "manual" })
    .where(eq(transcripts.id, meeting.transcript.id));

  return NextResponse.json({ speakerSegments: updatedSegments });
}
