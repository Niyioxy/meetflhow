import { NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { db } from "@/db";
import { meetings, transcripts, analysis, actionItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const meeting = await db.query.meetings.findFirst({
    where: and(eq(meetings.id, id), eq(meetings.userId, user.id)),
  });

  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [transcript, meetingAnalysis, items] = await Promise.all([
    db.query.transcripts.findFirst({ where: eq(transcripts.meetingId, id) }),
    db.query.analysis.findFirst({ where: eq(analysis.meetingId, id) }),
    db.query.actionItems.findMany({ where: eq(actionItems.meetingId, id) }),
  ]);

  return NextResponse.json({
    ...meeting,
    transcript: transcript
      ? {
          fullText: transcript.fullText,
          speakerSegments: transcript.speakerSegments,
          wordCount: transcript.wordCount,
          language: transcript.language,
        }
      : null,
    analysis: meetingAnalysis
      ? {
          summary: meetingAnalysis.summary,
          decisions: meetingAnalysis.decisions,
          openQuestions: meetingAnalysis.openQuestions,
          sentiment: meetingAnalysis.sentiment,
          meetingScore: meetingAnalysis.meetingScore,
          sentimentTimeline: meetingAnalysis.sentimentTimeline,
        }
      : null,
    actionItems: items.map((item) => ({
      id: item.id,
      task: item.task,
      owner: item.owner,
      deadline: item.deadline,
      priority: item.priority,
      status: item.status,
      completedAt: item.completedAt,
    })),
  });
}
