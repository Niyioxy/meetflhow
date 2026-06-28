import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetings, transcripts } from "@/db/schema";
import { runAllMeetingAnalyses, wordCount } from "@/lib/meetings";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  meetingId: z.string().uuid().optional(),
  title: z.string().optional(),
  platform: z.string().optional(),
  transcriptText: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { meetingId, title, platform, transcriptText } = parsed.data;
  const userId = session.user.id;

  let targetMeetingId: string;
  let textToAnalyze: string;

  if (meetingId) {
    const meeting = await db.query.meetings.findFirst({
      where: (m, { and, eq }) => and(eq(m.id, meetingId), eq(m.userId, userId)),
      with: { transcript: true },
    });

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (!meeting.transcript) {
      return NextResponse.json(
        { error: "Meeting has no transcript to analyze" },
        { status: 400 }
      );
    }

    targetMeetingId = meeting.id;
    textToAnalyze = meeting.transcript.fullText;
  } else {
    if (!transcriptText) {
      return NextResponse.json(
        { error: "transcriptText is required when meetingId is not provided" },
        { status: 400 }
      );
    }

    const [meeting] = await db
      .insert(meetings)
      .values({
        userId,
        title: title?.trim() || "Pasted transcript",
        platform: platform || "other",
        status: "transcribing",
      })
      .returning();

    await db.insert(transcripts).values({
      meetingId: meeting.id,
      fullText: transcriptText,
      language: null,
      wordCount: wordCount(transcriptText),
    });

    targetMeetingId = meeting.id;
    textToAnalyze = transcriptText;
  }

  try {
    await runAllMeetingAnalyses(targetMeetingId, textToAnalyze);
    return NextResponse.json({ meetingId: targetMeetingId, status: "ready" });
  } catch (error) {
    console.error("Analysis failed", error);
    return NextResponse.json(
      { error: "Failed to analyze transcript", meetingId: targetMeetingId },
      { status: 500 }
    );
  }
}
