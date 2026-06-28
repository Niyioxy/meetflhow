import { db } from "@/db";
import { actionItems, analysis, meetings, transcripts, tasks } from "@/db/schema";
import { analyzeTranscript } from "@/lib/gemini/analyze";
import { generateMeetingCoachScore } from "@/lib/gemini/coach";
import { generateSentimentTimeline } from "@/lib/gemini/sentiment";
import { identifySpeakers } from "@/lib/gemini/speakers";
import { eq } from "drizzle-orm";

async function getOrCreateAnalysisRow(meetingId: string) {
  const existing = await db.query.analysis.findFirst({
    where: (a, { eq }) => eq(a.meetingId, meetingId),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(analysis)
    .values({ meetingId, summary: "" })
    .returning();
  return created;
}

export async function runMeetingAnalysis(meetingId: string, transcriptText: string) {
  const row = await getOrCreateAnalysisRow(meetingId);
  if (row.summary) {
    return {
      summary: row.summary,
      decisions: row.decisions,
      openQuestions: row.openQuestions,
      sentiment: row.sentiment,
    };
  }

  const result = await analyzeTranscript(transcriptText);

  await db
    .update(analysis)
    .set({
      summary: result.summary,
      decisions: result.decisions,
      openQuestions: result.openQuestions,
      sentiment: result.sentiment,
    })
    .where(eq(analysis.id, row.id));

  if (result.actionItems.length > 0) {
    await db.insert(actionItems).values(
      result.actionItems.map((item) => ({
        meetingId,
        task: item.task,
        owner: item.owner,
        deadline: item.deadline,
        priority: item.priority,
      }))
    );

    const meeting = await db.query.meetings.findFirst({
      where: (m, { eq }) => eq(m.id, meetingId),
    });
    if (meeting) {
      await db.insert(tasks).values(
        result.actionItems.map((item) => ({
          userId: meeting.userId,
          meetingId,
          title: item.task,
          priority: item.priority,
          status: "backlog" as const,
          assignedTo: item.owner,
        }))
      );
    }
  }

  return result;
}

export async function runMeetingCoach(meetingId: string, transcriptText: string) {
  const row = await getOrCreateAnalysisRow(meetingId);
  if (row.meetingScore) return row.meetingScore;

  const score = await generateMeetingCoachScore(transcriptText);
  await db.update(analysis).set({ meetingScore: score }).where(eq(analysis.id, row.id));
  return score;
}

export async function runSentimentTimeline(meetingId: string, transcriptText: string) {
  const row = await getOrCreateAnalysisRow(meetingId);
  if (row.sentimentTimeline) return row.sentimentTimeline;

  const timeline = await generateSentimentTimeline(transcriptText);
  await db
    .update(analysis)
    .set({ sentimentTimeline: timeline })
    .where(eq(analysis.id, row.id));
  return timeline;
}

export async function runSpeakerIdentification(
  meetingId: string,
  transcriptText: string,
  attendees: string[] = []
) {
  const transcript = await db.query.transcripts.findFirst({
    where: (t, { eq }) => eq(t.meetingId, meetingId),
  });
  if (!transcript) {
    throw new Error("Transcript not found for meeting");
  }
  if (transcript.speakerSegments) return transcript.speakerSegments;

  const segments = await identifySpeakers(transcriptText, attendees);
  await db
    .update(transcripts)
    .set({ speakerSegments: segments })
    .where(eq(transcripts.id, transcript.id));
  return segments;
}

/**
 * Runs the core analysis plus the three supplementary AI analyses in parallel.
 * Supplementary failures are logged and swallowed so one flaky call doesn't
 * mark the whole meeting as failed when the core analysis succeeded.
 */
export async function runAllMeetingAnalyses(
  meetingId: string,
  transcriptText: string,
  attendees: string[] = []
) {
  await db.update(meetings).set({ status: "analyzing" }).where(eq(meetings.id, meetingId));

  await getOrCreateAnalysisRow(meetingId);

  const settle = (p: Promise<unknown>) =>
    p.catch((error) => {
      console.error("Supplementary meeting analysis failed", error);
      return null;
    });

  const [coreOk] = await Promise.all([
    runMeetingAnalysis(meetingId, transcriptText)
      .then(() => true)
      .catch((error) => {
        console.error("Meeting analysis failed", error);
        return false;
      }),
    settle(runMeetingCoach(meetingId, transcriptText)),
    settle(runSpeakerIdentification(meetingId, transcriptText, attendees)),
    settle(runSentimentTimeline(meetingId, transcriptText)),
  ]);

  await db
    .update(meetings)
    .set({ status: coreOk ? "ready" : "failed" })
    .where(eq(meetings.id, meetingId));

  if (!coreOk) {
    throw new Error("Meeting analysis failed");
  }
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export async function getMeetingDetail(meetingId: string, userId: string) {
  const meeting = await db.query.meetings.findFirst({
    where: (m, { and, eq }) => and(eq(m.id, meetingId), eq(m.userId, userId)),
    with: {
      transcript: true,
      analysis: true,
      actionItems: true,
    },
  });

  return meeting ?? null;
}

export async function ensureTranscriptOwnership(
  meetingId: string,
  userId: string
) {
  const meeting = await db.query.meetings.findFirst({
    where: (m, { and, eq }) => and(eq(m.id, meetingId), eq(m.userId, userId)),
  });
  return meeting ?? null;
}

/** Last N meetings for this user that have a completed analysis, most recent first. */
export async function getRecentMeetingSummaries(userId: string, limit = 5) {
  const rows = await db.query.meetings.findMany({
    where: (m, { eq }) => eq(m.userId, userId),
    orderBy: (m, { desc }) => desc(m.createdAt),
    limit,
    with: { analysis: true },
  });

  return rows.filter((m) => m.analysis?.summary);
}
