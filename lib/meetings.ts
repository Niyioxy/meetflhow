import { db } from "@/db";
import { actionItems, analysis, meetings, transcripts, tasks } from "@/db/schema";
import { analyzeTranscript } from "@/lib/gemini/analyze";
import { generateMeetingCoachScore } from "@/lib/gemini/coach";
import { generateSentimentTimeline } from "@/lib/gemini/sentiment";
import { identifySpeakers } from "@/lib/gemini/speakers";
import { generateCostVerdict } from "@/lib/gemini/cost-benchmark";
import { calculateMeetingCost } from "@/lib/cost";
import { triggerWebhooks } from "@/lib/webhooks";
import { postMeetingToSlack } from "@/lib/integrations/slack";
import type { AttendeeSalary, CalculatedCost } from "@/types/cost";
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
    const createdItems = await db
      .insert(actionItems)
      .values(
        result.actionItems.map((item) => ({
          meetingId,
          task: item.task,
          owner: item.owner,
          deadline: item.deadline,
          priority: item.priority,
        }))
      )
      .returning();

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

      await Promise.all(
        createdItems.map((item) =>
          triggerWebhooks(meeting.workspaceId, "action_item.created", {
            action_item_id: item.id,
            task: item.task,
            owner: item.owner,
            due_date: item.dueDate,
            meeting_id: meetingId,
          })
        )
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

  const meeting = await db.query.meetings.findFirst({
    where: (m, { eq }) => eq(m.id, meetingId),
  });
  await triggerWebhooks(meeting?.workspaceId, "meeting.scored", {
    meeting_id: meetingId,
    title: meeting?.title ?? null,
    overall_score: score.overall_score,
  });

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

async function autoPostToSlackIfEnabled(meetingId: string, workspaceId: string | null) {
  if (!workspaceId) return;

  try {
    const settings = await db.query.slackPostSettings.findFirst({
      where: (s, { eq }) => eq(s.workspaceId, workspaceId),
    });
    if (!settings || (!settings.autoPostSummary && !settings.autoPostActionItems)) return;

    await postMeetingToSlack(meetingId, {
      includeSummary: settings.autoPostSummary,
      includeActionItems: settings.autoPostActionItems,
    });
  } catch (error) {
    console.error("Auto-post to Slack failed", error);
  }
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

  const [updatedMeeting] = await db
    .update(meetings)
    .set({ status: coreOk ? "ready" : "failed" })
    .where(eq(meetings.id, meetingId))
    .returning();

  if (coreOk && updatedMeeting) {
    const analysisRow = await db.query.analysis.findFirst({
      where: (a, { eq }) => eq(a.meetingId, meetingId),
    });

    await Promise.all([
      triggerWebhooks(updatedMeeting.workspaceId, "meeting.completed", {
        meeting_id: updatedMeeting.id,
        title: updatedMeeting.title,
        platform: updatedMeeting.platform,
        duration_seconds: updatedMeeting.durationSeconds,
        summary: analysisRow?.summary ?? null,
        url: `${process.env.NEXTAUTH_URL}/meetings/${updatedMeeting.id}`,
      }),
      autoPostToSlackIfEnabled(meetingId, updatedMeeting.workspaceId),
    ]);
  }

  if (!coreOk) {
    throw new Error("Meeting analysis failed");
  }
}

export async function saveAttendeeSalaries(meetingId: string, attendees: AttendeeSalary[]) {
  await db.update(meetings).set({ attendeeSalaries: attendees, calculatedCost: null }).where(eq(meetings.id, meetingId));
}

export async function runMeetingCostAnalysis(meetingId: string): Promise<CalculatedCost> {
  const meeting = await db.query.meetings.findFirst({
    where: (m, { eq }) => eq(m.id, meetingId),
    with: { analysis: true, actionItems: true },
  });

  if (!meeting) {
    throw new Error("Meeting not found");
  }
  if (!meeting.attendeeSalaries || meeting.attendeeSalaries.length === 0) {
    throw new Error("No attendee salaries saved for this meeting");
  }
  if (!meeting.durationSeconds) {
    throw new Error("Meeting has no duration yet");
  }

  const calc = calculateMeetingCost(meeting.attendeeSalaries, meeting.durationSeconds);

  const existing = meeting.calculatedCost;
  if (existing && existing.signature === calc.signature && existing.verdict) {
    return existing;
  }

  let verdict: { verdict: string; reasoning: string; suggestion: string } | null = null;
  try {
    verdict = await generateCostVerdict({
      title: meeting.title,
      totalCost: calc.total_cost,
      currency: calc.currency,
      durationMinutes: Math.round(meeting.durationSeconds / 60),
      summary: meeting.analysis?.summary ?? null,
      decisionsCount: meeting.analysis?.decisions.length ?? 0,
      actionItemsCount: meeting.actionItems.length,
    });
  } catch (error) {
    console.error("Cost benchmark failed", error);
  }

  const result: CalculatedCost = {
    ...calc,
    verdict: (verdict?.verdict as CalculatedCost["verdict"]) ?? null,
    reasoning: verdict?.reasoning ?? null,
    suggestion: verdict?.suggestion ?? null,
  };

  await db.update(meetings).set({ calculatedCost: result }).where(eq(meetings.id, meetingId));
  return result;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export async function getMeetingDetail(meetingId: string, userId: string) {
  const meeting = await db.query.meetings.findFirst({
    where: (m, { eq }) => eq(m.id, meetingId),
    with: {
      transcript: true,
      analysis: true,
      actionItems: true,
    },
  });

  if (!meeting) return null;
  if (meeting.userId === userId) return meeting;

  if (meeting.sharedWithWorkspace && meeting.workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: (m, { and, eq }) => and(eq(m.workspaceId, meeting.workspaceId!), eq(m.userId, userId)),
    });
    if (membership) return meeting;
  }

  return null;
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
