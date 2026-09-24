import { randomUUID } from "crypto";
import { db } from "@/db";
import {
  actionItems,
  analysis,
  meetingEvents,
  meetings,
  transcripts,
  tasks,
  type ContentType,
} from "@/db/schema";
import { analyzeTranscript } from "@/lib/gemini/analyze";
import { generateMeetingCoachScore } from "@/lib/gemini/coach";
import { generateSermonCoach } from "@/lib/gemini/sermon-coach";
import { generateSentimentTimeline } from "@/lib/gemini/sentiment";
import { generateSermonGuide, generatePodcastNotes } from "@/lib/gemini/vertical-content";
import { identifySpeakers, nameSpeakerLabels } from "@/lib/gemini/speakers";
import { generateCostVerdict } from "@/lib/gemini/cost-benchmark";
import { calculateMeetingCost } from "@/lib/cost";
import { webhookEffects } from "@/lib/webhooks";
import { attributeActionItemsToSpeakers } from "@/lib/action-item-attribution";
import { logMeetingEvent } from "@/lib/meeting-events";
import { noShowRecapEffects } from "@/lib/no-show-recap";
import { atomic } from "@/lib/processing/atomic";
import { claimStage, isLeaseLostError, leaseFence, releaseStage } from "@/lib/processing/lease";
import { enqueueEffectsQuery, type EffectSpec } from "@/lib/processing/effects";
import { dispatchEffects } from "@/lib/processing/dispatch";
import type { AttendeeSalary, CalculatedCost } from "@/types/cost";
import type { SpeakerSegment } from "@/types/analysis";
import type { TranscriptUtterance } from "@/lib/deepgram/transcribe";
import type { VoiceMatch } from "@/lib/voice-identification";
import { and, eq, isNull, sql } from "drizzle-orm";

const SUPPLEMENTARY_TIMEOUT_MS = 40_000;

/**
 * Races a promise against a timeout. Used to bound each Gemini call inside
 * runAllMeetingAnalyses — this function runs inside a single serverless
 * invocation with a hard platform time limit (60s), so if a call hangs, we
 * need it to fail cleanly (and let the meeting be marked failed) well
 * before the platform kills the whole invocation mid-flight, which would
 * otherwise leave the meeting stuck in "analyzing" forever with no way to
 * recover on its own.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Builds speakerSegments directly from Deepgram's diarized utterances rather
 * than asking Gemini to reconstruct turns from flat text. Labels with a voice
 * match get the enrolled user's real name; the rest go through a smaller,
 * cheaper Gemini call that only guesses names for the unmatched labels.
 */
async function buildDiarizedSegments(
  utterances: TranscriptUtterance[],
  attendees: string[],
  voiceMatches: Record<string, VoiceMatch>
): Promise<SpeakerSegment[]> {
  const unmatchedLabels = new Map<number, TranscriptUtterance[]>();
  for (const u of utterances) {
    if (!voiceMatches[String(u.speaker)]) {
      const list = unmatchedLabels.get(u.speaker) ?? [];
      list.push(u);
      unmatchedLabels.set(u.speaker, list);
    }
  }

  let guessedNames: Record<string, string> = {};
  if (unmatchedLabels.size > 0) {
    const labelSamples = Array.from(unmatchedLabels.entries()).map(([speaker, us]) => ({
      label: `Speaker ${speaker}`,
      samples: us.slice(0, 3).map((u) => u.transcript),
    }));
    try {
      guessedNames = await nameSpeakerLabels(labelSamples, attendees);
    } catch (error) {
      console.error("Speaker label naming failed", error);
    }
  }

  return utterances.map((u) => {
    const match = voiceMatches[String(u.speaker)];
    const label = `Speaker ${u.speaker}`;
    if (match) {
      return {
        speaker: match.name,
        text: u.transcript,
        timestamp_approx: formatTimestamp(u.start),
        identificationMethod: "voice_match",
        matchedUserId: match.userId,
        confidence: match.confidence,
      };
    }
    return {
      speaker: guessedNames[label] ?? label,
      text: u.transcript,
      timestamp_approx: formatTimestamp(u.start),
      identificationMethod: "ai_inference",
      matchedUserId: null,
      confidence: null,
    };
  });
}

/**
 * The meeting's analysis row, created empty if it doesn't exist yet — as a
 * single atomic upsert, so concurrent callers get the same row rather than
 * racing to insert two.
 */
async function ensureAnalysisRow(meetingId: string) {
  const [row] = await db
    .insert(analysis)
    .values({ meetingId, summary: "" })
    .onConflictDoUpdate({
      target: analysis.meetingId,
      set: { meetingId: sql`excluded.meeting_id` },
    })
    .returning();
  return row;
}

type CoreAnalysisResult = Awaited<ReturnType<typeof analyzeTranscript>>;

/**
 * The core analysis: summary, decisions, action items and a task mirroring
 * each action item. Everything it produces — plus the action_item.created
 * webhook deliveries, queued in the ledger and sent only after commit — is
 * written in one transaction, fenced by the processing lease so a superseded
 * attempt can't write at all. Idempotent: once complete it returns without
 * calling Gemini again.
 */
async function runCoreAnalysis(
  meetingId: string,
  attemptId: string,
  transcriptText: string,
  meeting: { userId: string; workspaceId: string | null; contentType: ContentType }
): Promise<void> {
  const row = await ensureAnalysisRow(meetingId);
  if (row.coreCompletedAt) return;

  const existingItems = await db.query.actionItems.findMany({
    where: (a, { eq }) => eq(a.meetingId, meetingId),
    orderBy: (a, { asc }) => [asc(a.createdAt), asc(a.id)],
  });

  // A summary *and* action items with no completion mark is output from
  // before this was transactional, whose run died before creating the tasks
  // or reaching "ready". Finish it from what's there instead of paying for —
  // and diverging from — a second Gemini run.
  let result: CoreAnalysisResult | null = null;
  if (!(row.summary && existingItems.length > 0)) {
    result = await analyzeTranscript(transcriptText, meeting.contentType);
  }

  // Only this pipeline creates action items, so any that exist are this
  // meeting's earlier output. Keep them (someone may already be working on
  // them) and never add a second set.
  const newItems =
    existingItems.length > 0 || !result
      ? []
      : result.actionItems.map((item) => ({
          id: randomUUID(),
          meetingId,
          task: item.task,
          owner: item.owner,
          deadline: item.deadline,
          priority: item.priority,
          dueDate: null,
        }));
  const items = newItems.length > 0 ? newItems : existingItems;

  const itemEffects = await webhookEffects(
    meeting.workspaceId,
    meetingId,
    "action_item.created",
    items.map((item) => ({
      key: item.id,
      data: {
        action_item_id: item.id,
        task: item.task,
        owner: item.owner,
        due_date: item.dueDate,
        meeting_id: meetingId,
      },
    }))
  );

  await atomic([
    leaseFence(meetingId, attemptId),
    db
      .update(analysis)
      .set({
        ...(result
          ? {
              summary: result.summary,
              decisions: result.decisions,
              openQuestions: result.openQuestions,
              highlights: result.highlights,
              sentiment: result.sentiment,
            }
          : {}),
        coreCompletedAt: sql`now()`,
      })
      .where(and(eq(analysis.id, row.id), isNull(analysis.coreCompletedAt))),
    newItems.length > 0 && db.insert(actionItems).values(newItems),
    items.length > 0 &&
      db
        .insert(tasks)
        .values(
          items.map((item) => ({
            userId: meeting.userId,
            meetingId,
            actionItemId: item.id,
            title: item.task,
            priority: item.priority,
            status: "backlog" as const,
            assignedTo: item.owner,
          }))
        )
        .onConflictDoNothing({ target: tasks.actionItemId }),
    enqueueEffectsQuery(itemEffects),
  ]);
}

export type CoachKind = "meeting" | "sermon" | "none";

/**
 * Which coach suits a content type. Each coach's dimensions only mean
 * something for its own kind of recording — Meeting Coach's decisiveness
 * and talk-time balance are meaningless for a sermon or a podcast — so
 * podcasts get no coach until a dedicated Podcast Coach exists.
 */
export function coachForContentType(contentType: ContentType): CoachKind {
  switch (contentType) {
    case "meeting":
    case "training":
      return "meeting";
    case "sermon":
      return "sermon";
    case "podcast":
      return "none";
  }
}

/**
 * Private preaching feedback (see lib/gemini/sermon-coach.ts). Unlike Meeting
 * Coach it fires no webhook — nothing about it leaves the app.
 */
export async function runSermonCoach(meetingId: string) {
  const row = await ensureAnalysisRow(meetingId);
  if (row.sermonCoach) return row.sermonCoach;

  const meeting = await db.query.meetings.findFirst({
    where: (m, { eq }) => eq(m.id, meetingId),
    with: { transcript: true, workspace: true },
  });
  if (!meeting?.transcript) {
    throw new Error("Transcript not found for meeting");
  }

  const coach = await generateSermonCoach({
    transcriptText: meeting.transcript.fullText,
    utterances: meeting.transcript.utterances,
    tradition: meeting.workspace?.sermonCoachTradition ?? null,
  });

  const [written] = await db
    .update(analysis)
    .set({ sermonCoach: coach })
    .where(and(eq(analysis.id, row.id), isNull(analysis.sermonCoach)))
    .returning({ sermonCoach: analysis.sermonCoach });
  if (written?.sermonCoach) return written.sermonCoach;

  // A concurrent run stored its result first — return that one.
  const current = await db.query.analysis.findFirst({ where: (a, { eq }) => eq(a.id, row.id) });
  return current?.sermonCoach ?? coach;
}

/** Runs whichever coach suits the content type, if any, bounded like the other supplementary analyses. */
async function runCoach(meetingId: string, contentType: ContentType, transcriptText: string) {
  switch (coachForContentType(contentType)) {
    case "sermon":
      return withTimeout(runSermonCoach(meetingId), SUPPLEMENTARY_TIMEOUT_MS, "Sermon coach");
    case "meeting":
      return withTimeout(runMeetingCoach(meetingId, transcriptText), SUPPLEMENTARY_TIMEOUT_MS, "Meeting coach");
    case "none":
      return null;
  }
}

export async function runMeetingCoach(meetingId: string, transcriptText: string) {
  const row = await ensureAnalysisRow(meetingId);
  if (row.meetingScore) return row.meetingScore;

  const score = await generateMeetingCoachScore(transcriptText);

  const meeting = await db.query.meetings.findFirst({
    where: (m, { eq }) => eq(m.id, meetingId),
  });
  const effects = await webhookEffects(meeting?.workspaceId, meetingId, "meeting.scored", [
    {
      key: meetingId,
      data: {
        meeting_id: meetingId,
        title: meeting?.title ?? null,
        overall_score: score.overall_score,
      },
    },
  ]);

  // The ledger key is per meeting, so even if two scorings race, the
  // meeting.scored webhook goes out once.
  await atomic([
    db
      .update(analysis)
      .set({ meetingScore: score })
      .where(and(eq(analysis.id, row.id), isNull(analysis.meetingScore))),
    enqueueEffectsQuery(effects),
  ]);
  await dispatchEffects({ keys: effects.map((e) => e.key) });

  return score;
}

export async function runSentimentTimeline(meetingId: string, transcriptText: string) {
  const row = await ensureAnalysisRow(meetingId);
  if (row.sentimentTimeline) return row.sentimentTimeline;

  const timeline = await generateSentimentTimeline(transcriptText);
  await db
    .update(analysis)
    .set({ sentimentTimeline: timeline })
    .where(and(eq(analysis.id, row.id), isNull(analysis.sentimentTimeline)));
  return timeline;
}

/**
 * Content-type-native output — a sermon discussion guide or podcast show
 * notes — distinct from the generic summary/highlights every content type
 * already gets. Only meaningful for the two content types that have a
 * genuinely different downstream use than "meeting notes".
 */
export async function runVerticalContent(
  meetingId: string,
  transcriptText: string,
  contentType: ContentType
) {
  const row = await ensureAnalysisRow(meetingId);
  if (row.verticalContent) return row.verticalContent;

  let result;
  if (contentType === "sermon") {
    result = await generateSermonGuide(transcriptText);
  } else if (contentType === "podcast") {
    result = await generatePodcastNotes(transcriptText);
  } else {
    throw new Error(`Vertical content isn't available for content type "${contentType}"`);
  }

  await db
    .update(analysis)
    .set({ verticalContent: result })
    .where(and(eq(analysis.id, row.id), isNull(analysis.verticalContent)));
  return result;
}

export async function runSpeakerIdentification(
  meetingId: string,
  transcriptText: string,
  attendees: string[] = [],
  utterances?: TranscriptUtterance[],
  voiceMatches?: Record<string, VoiceMatch>
) {
  const transcript = await db.query.transcripts.findFirst({
    where: (t, { eq }) => eq(t.meetingId, meetingId),
  });
  if (!transcript) {
    throw new Error("Transcript not found for meeting");
  }
  if (transcript.speakerSegments) return transcript.speakerSegments;

  const unset = and(eq(transcripts.id, transcript.id), isNull(transcripts.speakerSegments));

  if (utterances && utterances.length > 0) {
    const segments = await buildDiarizedSegments(utterances, attendees, voiceMatches ?? {});
    const method = segments.some((s) => s.identificationMethod === "voice_match")
      ? ("voice_match" as const)
      : ("ai_inference" as const);
    await db
      .update(transcripts)
      .set({ speakerSegments: segments, speakerIdentificationMethod: method })
      .where(unset);
    return segments;
  }

  const segments = await identifySpeakers(transcriptText, attendees);
  await db.update(transcripts).set({ speakerSegments: segments }).where(unset);
  return segments;
}

async function slackAutoPostEffects(
  meetingId: string,
  workspaceId: string | null
): Promise<EffectSpec[]> {
  if (!workspaceId) return [];

  const settings = await db.query.slackPostSettings.findFirst({
    where: (s, { eq }) => eq(s.workspaceId, workspaceId),
  });
  if (!settings || (!settings.autoPostSummary && !settings.autoPostActionItems)) return [];

  return [
    {
      key: `slack-auto-post:${meetingId}`,
      kind: "slack_auto_post",
      meetingId,
      payload: {
        meetingId,
        includeSummary: settings.autoPostSummary,
        includeActionItems: settings.autoPostActionItems,
      },
    },
  ];
}

/** Everything a meeting reaching "ready" should notify: webhooks, Slack, no-show recaps. */
async function completionEffects(meeting: {
  id: string;
  title: string;
  platform: string;
  durationSeconds: number | null;
  workspaceId: string | null;
}): Promise<EffectSpec[]> {
  const analysisRow = await db.query.analysis.findFirst({
    where: (a, { eq }) => eq(a.meetingId, meeting.id),
  });

  const [webhookOut, slackOut, noShowOut] = await Promise.all([
    webhookEffects(meeting.workspaceId, meeting.id, "meeting.completed", [
      {
        key: meeting.id,
        data: {
          meeting_id: meeting.id,
          title: meeting.title,
          platform: meeting.platform,
          duration_seconds: meeting.durationSeconds,
          summary: analysisRow?.summary ?? null,
          url: `${process.env.NEXTAUTH_URL}/meetings/${meeting.id}`,
        },
      },
    ]),
    slackAutoPostEffects(meeting.id, meeting.workspaceId),
    noShowRecapEffects(meeting.id).catch((error) => {
      console.error("No-show recap detection failed", error);
      return [] as EffectSpec[];
    }),
  ]);
  return [...webhookOut, ...slackOut, ...noShowOut];
}

export type AnalysisRunOutcome =
  /** This call ran the analysis and the meeting is ready. */
  | "ready"
  /** Nothing to do: already running elsewhere, already finished, or not queued. */
  | "skipped"
  /** Another attempt took the meeting over before this one could commit. */
  | "superseded";

/**
 * Runs the core analysis plus the three supplementary AI analyses in parallel.
 * Supplementary failures are logged and swallowed so one flaky call doesn't
 * mark the whole meeting as failed when the core analysis succeeded.
 *
 * Only runs if it can claim the meeting's "analyzing" stage (see
 * lib/processing/lease.ts), so duplicate triggers are no-ops. Throws if the
 * core analysis fails, after marking the meeting failed.
 */
export async function runAllMeetingAnalyses(
  meetingId: string,
  transcriptText: string,
  attendees: string[] = [],
  utterances?: TranscriptUtterance[],
  voiceMatches?: Record<string, VoiceMatch>
): Promise<AnalysisRunOutcome> {
  const attemptId = await claimStage(meetingId, "analyzing");
  if (!attemptId) {
    console.info(`Analysis of meeting ${meetingId} not claimed: running elsewhere, done, or not queued`);
    return "skipped";
  }
  await logMeetingEvent(meetingId, "analyzing");

  const meetingRow = await db.query.meetings.findFirst({
    where: (m, { eq }) => eq(m.id, meetingId),
  });
  if (!meetingRow) return "skipped";

  const settle = (p: Promise<unknown>) =>
    p.catch((error) => {
      console.error("Supplementary meeting analysis failed", error);
      return null;
    });

  const [coreOk] = await Promise.all([
    withTimeout(
      runCoreAnalysis(meetingId, attemptId, transcriptText, meetingRow),
      SUPPLEMENTARY_TIMEOUT_MS,
      "Meeting analysis"
    )
      .then(() => true)
      .catch((error) => {
        console.error("Meeting analysis failed", error);
        return false;
      }),
    settle(runCoach(meetingId, meetingRow.contentType, transcriptText)),
    settle(
      withTimeout(
        runSpeakerIdentification(meetingId, transcriptText, attendees, utterances, voiceMatches),
        SUPPLEMENTARY_TIMEOUT_MS,
        "Speaker identification"
      )
    ),
    settle(
      withTimeout(runSentimentTimeline(meetingId, transcriptText), SUPPLEMENTARY_TIMEOUT_MS, "Sentiment timeline")
    ),
  ]);

  try {
    if (coreOk) {
      const transcriptRow = await db.query.transcripts.findFirst({
        where: (t, { eq }) => eq(t.meetingId, meetingId),
      });
      await attributeActionItemsToSpeakers(meetingId, transcriptRow?.speakerSegments);

      // "ready" and the notifications it owes commit together, so a crash
      // right after can't lose them — they stay queued in the ledger.
      const effects = await completionEffects(meetingRow);
      await atomic([
        leaseFence(meetingId, attemptId),
        releaseStage(meetingId, attemptId, "ready"),
        db.insert(meetingEvents).values({ meetingId, event: "ready" }),
        enqueueEffectsQuery(effects),
      ]);
    } else {
      await atomic([
        leaseFence(meetingId, attemptId),
        releaseStage(meetingId, attemptId, "failed"),
        db.insert(meetingEvents).values({
          meetingId,
          event: "failed",
          detail: "Meeting analysis failed",
        }),
      ]);
    }
  } catch (error) {
    if (isLeaseLostError(error)) {
      console.warn(`Analysis attempt ${attemptId} for meeting ${meetingId} was superseded`);
      return "superseded";
    }
    throw error;
  }

  if (!coreOk) {
    throw new Error("Meeting analysis failed");
  }

  // After commit: deliver this run's effects, plus any a crashed earlier run
  // left queued. Each ledger entry is sent at most once successfully.
  await dispatchEffects({ meetingId }).catch((error) =>
    console.error("Dispatching meeting effects failed", error)
  );
  return "ready";
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
      events: {
        orderBy: (e, { asc }) => [asc(e.createdAt)],
      },
    },
  });

  if (!meeting) return null;
  if (meeting.userId === userId) return meeting;

  if (meeting.sharedWithWorkspace && meeting.workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: (m, { and, eq }) => and(eq(m.workspaceId, meeting.workspaceId!), eq(m.userId, userId)),
    });
    if (membership) {
      // Sermon Coach is private to the preacher: workspace members can open
      // a shared sermon, but never its coaching — stripped here so no
      // caller of this function can leak it.
      return meeting.analysis
        ? { ...meeting, analysis: { ...meeting.analysis, sermonCoach: null } }
        : meeting;
    }
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
