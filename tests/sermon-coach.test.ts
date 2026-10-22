import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { eq } from "drizzle-orm";
import { geminiJSON } from "@/lib/gemini/json";
import { auth } from "@/auth";
import { getMeetingDetail, runAllMeetingAnalyses } from "@/lib/meetings";
import { buildTranscriptIndex, groundSermonCoach, type RawSermonCoach } from "@/lib/sermon-coach/grounding";
import { createOrUpdateShare, getPublicShare } from "@/lib/shares";
import { POST as sermonCoachRoute } from "@/app/api/meetings/[id]/sermon-coach/route";
import { POST as meetingCoachRoute } from "@/app/api/meetings/[id]/coach/route";
import * as schema from "@/db/schema";
import { sermonCoachDimensionKeys, type TranscriptUtterance } from "@/types/analysis";
import { resetDb } from "./helpers/test-db";
import { fetchCallsTo, mocks, resetMocks } from "./helpers/mocks";
import { seedMeeting, seedPipelineWorkspace, seedUser, testDb } from "./helpers/fixtures";

// The real prompt building and evidence grounding run; only the model call
// (geminiJSON, mocked in tests/setup.ts) is faked.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

const geminiMock = geminiJSON as unknown as Mock;
const authMock = auth as unknown as Mock;

const UTTERANCES: TranscriptUtterance[] = [
  { speaker: 0, start: 0, end: 9, transcript: "Good morning church. Please open your Bibles to John chapter fifteen." },
  { speaker: 0, start: 12, end: 20, transcript: "Jesus says I am the vine and you are the branches, and that is our whole message today." },
  { speaker: 0, start: 95, end: 104, transcript: "The Greek word for abide is meno, which literally means to stay put forever." },
  { speaker: 0, start: 130, end: 139, transcript: "So this week, pick one morning and read John fifteen before you open your phone." },
  { speaker: 0, start: 200, end: 210, transcript: "Imagine a branch lying on the driveway. It looks alive for a day, then it withers." },
];
const FULL_TEXT = UTTERANCES.map((u) => u.transcript).join(" ");
const FABRICATED = "turn with me now to the book of Romans chapter eight";

function rawCoach(overrides: Partial<RawSermonCoach> = {}): RawSermonCoach {
  const dimensions = Object.fromEntries(
    sermonCoachDimensionKeys.map((key, i) => [
      key,
      {
        score: 60 + i,
        summary: `${key} summary`,
        excerpts: ["I am the vine and you are the branches", FABRICATED],
      },
    ])
  ) as RawSermonCoach["dimensions"];
  return {
    dimensions,
    strengths: [
      { point: "Concrete application", excerpt: "pick one morning and read John fifteen" },
      { point: "Invented strength", excerpt: FABRICATED },
    ],
    improvements: [{ point: "Explain 'abide' for newcomers", excerpt: "The Greek word for abide is meno" }],
    unclearOrRepetitive: [],
    suggestedCuts: [],
    // Different case/punctuation and a stray timestamp marker still match.
    strongestMoment: { point: "Vivid image", excerpt: "[3:20] imagine a branch lying on the driveway!" },
    nextSermonFocus: { point: "Invented focus", excerpt: FABRICATED },
    claimsToVerify: [
      {
        claim: "Meno literally means to stay put forever",
        excerpt: "meno, which literally means to stay put forever",
        passage: "John 15",
        passageExcerpt: "open your Bibles to John chapter fifteen",
        reason: "Check the range of meaning of menō in a lexicon.",
      },
      {
        claim: "A passage never cited in this sermon",
        excerpt: "meno, which literally means to stay put forever",
        passage: "Romans 8",
        passageExcerpt: FABRICATED,
        reason: "Should be omitted: its passage is never cited.",
      },
    ],
    traditionNotes: [{ point: "Perseverance emphasis", excerpt: "It looks alive for a day, then it withers" }],
    ...overrides,
  };
}

beforeEach(async () => {
  await resetDb();
  resetMocks();
  geminiMock.mockReset();
  geminiMock.mockResolvedValue(rawCoach());
  authMock.mockReset();
});

describe("evidence grounding", () => {
  const index = buildTranscriptIndex(FULL_TEXT, UTTERANCES);

  it("keeps observations whose quote is in the sermon, with the recording's timestamp", () => {
    const coach = groundSermonCoach(rawCoach(), index, null);

    expect(coach.strongestMoment?.evidence).toEqual({
      excerpt: "imagine a branch lying on the driveway!",
      timestamp: "3:20",
    });
    expect(coach.strengths).toEqual([
      {
        point: "Concrete application",
        evidence: { excerpt: "pick one morning and read John fifteen", timestamp: "2:10" },
      },
    ]);
    expect(coach.timestampsAvailable).toBe(true);
  });

  it("omits anything whose quote can't be found, rather than flagging it", () => {
    const coach = groundSermonCoach(rawCoach(), index, null);

    expect(coach.nextSermonFocus).toBeNull();
    expect(coach.strengths.map((s) => s.point)).not.toContain("Invented strength");
    for (const key of sermonCoachDimensionKeys) {
      expect(coach.dimensions[key].evidence.map((e) => e.excerpt)).toEqual([
        "I am the vine and you are the branches",
      ]);
    }
    // 7 dimension quotes + 1 strength + next focus + 1 claim.
    expect(coach.omittedForMissingEvidence).toBe(10);
  });

  it("keeps a claim only when both its statement and its cited passage are quoted", () => {
    const coach = groundSermonCoach(rawCoach(), index, null);

    expect(coach.claimsToVerify).toHaveLength(1);
    expect(coach.claimsToVerify[0]).toMatchObject({
      passage: "John 15",
      evidence: { timestamp: "1:35" },
      passageEvidence: { excerpt: "open your Bibles to John chapter fifteen", timestamp: "0:00" },
    });
  });

  it("computes the overall score itself from clamped dimension scores", () => {
    const raw = rawCoach();
    raw.dimensions.bigIdeaClarity.score = 130;
    raw.dimensions.scriptureGrounding.score = -5;
    const coach = groundSermonCoach(raw, index, null);

    const scores = sermonCoachDimensionKeys.map((k) => coach.dimensions[k].score as number);
    expect(scores[0]).toBe(100);
    expect(scores[1]).toBe(0);
    expect(coach.overallScore).toBe(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
  });

  it("withholds a dimension's score, and keeps it out of the overall, when none of its quotes are real", () => {
    const raw = rawCoach();
    // A harsh score backed only by an invented quote must not drag the headline down.
    raw.dimensions.scriptureGrounding = { score: 5, summary: "Unsupported", excerpts: [FABRICATED] };
    const coach = groundSermonCoach(raw, index, null);

    expect(coach.dimensions.scriptureGrounding).toMatchObject({
      score: null,
      insufficientEvidence: true,
      evidence: [],
    });
    const grounded = sermonCoachDimensionKeys
      .filter((k) => k !== "scriptureGrounding")
      .map((k) => coach.dimensions[k].score as number);
    expect(grounded.every((s) => typeof s === "number")).toBe(true);
    expect(coach.overallScore).toBe(Math.round(grounded.reduce((a, b) => a + b, 0) / grounded.length));
  });

  it("has no overall score when no dimension could be grounded", () => {
    const raw = rawCoach();
    for (const key of sermonCoachDimensionKeys) {
      raw.dimensions[key] = { score: 90, summary: "Unsupported", excerpts: [FABRICATED] };
    }
    const coach = groundSermonCoach(raw, index, null);

    expect(coach.overallScore).toBeNull();
    expect(sermonCoachDimensionKeys.every((k) => coach.dimensions[k].insufficientEvidence)).toBe(true);
  });

  it("only includes tradition notes when the workspace opted into a tradition", () => {
    expect(groundSermonCoach(rawCoach(), index, null).traditionNotes).toEqual([]);
    expect(groundSermonCoach(rawCoach(), index, "Reformed Baptist").traditionNotes).toHaveLength(1);
  });

  it("uses excerpts without timestamps for pasted transcripts", () => {
    const coach = groundSermonCoach(rawCoach(), buildTranscriptIndex(FULL_TEXT, null), null);

    expect(coach.timestampsAvailable).toBe(false);
    expect(coach.strongestMoment?.evidence.timestamp).toBeNull();
    expect(coach.claimsToVerify).toHaveLength(1);
  });

  it("rejects quotes too short to prove anything, and partial-word matches", () => {
    const raw = rawCoach({
      strengths: [
        { point: "Too short", excerpt: "the vine" },
        { point: "Partial word", excerpt: "ines and you are the branches" },
      ],
    });
    expect(groundSermonCoach(raw, index, null).strengths).toEqual([]);
  });
});

async function seedSermon(options: { tradition?: string } = {}) {
  const { user, workspace, webhook } = await seedPipelineWorkspace();
  const db = await testDb();
  if (options.tradition) {
    await db
      .update(schema.workspaces)
      .set({ sermonCoachTradition: options.tradition })
      .where(eq(schema.workspaces.id, workspace.id));
  }
  const [meeting] = await db
    .insert(schema.meetings)
    .values({
      userId: user.id,
      workspaceId: workspace.id,
      sharedWithWorkspace: true,
      title: "Abide",
      contentType: "sermon",
      status: "analyzing",
    })
    .returning();
  await db.insert(schema.transcripts).values({
    meetingId: meeting.id,
    fullText: FULL_TEXT,
    wordCount: FULL_TEXT.split(" ").length,
    utterances: UTTERANCES,
  });
  return { user, workspace, webhook, meeting };
}

describe("coach selection in the pipeline", () => {
  it("coaches sermons with Sermon Coach — never Meeting Coach, and no webhook", async () => {
    const { meeting, webhook } = await seedSermon({ tradition: "Reformed Baptist" });

    expect(await runAllMeetingAnalyses(meeting.id, FULL_TEXT)).toBe("ready");

    expect(mocks.coach).not.toHaveBeenCalled();
    expect(geminiMock).toHaveBeenCalledTimes(1);
    expect(geminiMock.mock.calls[0][0]).toContain('"Reformed Baptist" tradition');

    const db = await testDb();
    const [row] = await db.select().from(schema.analysis).where(eq(schema.analysis.meetingId, meeting.id));
    expect(row.meetingScore).toBeNull();
    expect(row.sermonCoach?.tradition).toBe("Reformed Baptist");
    expect(row.sermonCoach?.claimsToVerify).toHaveLength(1);

    const events = fetchCallsTo(webhook.url).map(
      ([, init]) => ((init as RequestInit).headers as Record<string, string>)["X-MeetFlhow-Event"]
    );
    expect(events).not.toContain("meeting.scored");
  });

  it("tells the model not to assess doctrine when no tradition is set", async () => {
    const { meeting } = await seedSermon();
    await runAllMeetingAnalyses(meeting.id, FULL_TEXT);
    expect(geminiMock.mock.calls[0][0]).toContain("Do not comment on doctrine");
  });

  it("keeps Meeting Coach for meetings", async () => {
    const { user, workspace } = await seedPipelineWorkspace();
    const meeting = await seedMeeting({ userId: user.id, workspaceId: workspace.id, status: "analyzing" });
    const db = await testDb();
    await db.insert(schema.transcripts).values({ meetingId: meeting.id, fullText: FULL_TEXT });

    await runAllMeetingAnalyses(meeting.id, FULL_TEXT);

    expect(mocks.coach).toHaveBeenCalledTimes(1);
    expect(geminiMock).not.toHaveBeenCalled();
  });

  it("runs no coach for podcasts until a Podcast Coach exists", async () => {
    const { user, workspace, webhook } = await seedPipelineWorkspace();
    const db = await testDb();
    const [meeting] = await db
      .insert(schema.meetings)
      .values({ userId: user.id, workspaceId: workspace.id, title: "Ep 1", contentType: "podcast", status: "analyzing" })
      .returning();
    await db.insert(schema.transcripts).values({ meetingId: meeting.id, fullText: FULL_TEXT });

    expect(await runAllMeetingAnalyses(meeting.id, FULL_TEXT)).toBe("ready");

    expect(mocks.coach).not.toHaveBeenCalled();
    expect(geminiMock).not.toHaveBeenCalled();
    const [row] = await db.select().from(schema.analysis).where(eq(schema.analysis.meetingId, meeting.id));
    expect(row.meetingScore).toBeNull();
    expect(row.sermonCoach).toBeNull();
    const events = fetchCallsTo(webhook.url).map(
      ([, init]) => ((init as RequestInit).headers as Record<string, string>)["X-MeetFlhow-Event"]
    );
    expect(events).not.toContain("meeting.scored");
  });
});

describe("Sermon Coach privacy", () => {
  async function seedCoachedSermon() {
    const seeded = await seedSermon();
    await runAllMeetingAnalyses(seeded.meeting.id, FULL_TEXT);
    const member = await seedUser();
    const db = await testDb();
    await db
      .insert(schema.workspaceMembers)
      .values({ workspaceId: seeded.workspace.id, userId: member.id, role: "member" });
    return { ...seeded, member };
  }

  type MeetingRoute = (req: Request, ctx: { params: { id: string } }) => Promise<Response>;
  const post = (route: MeetingRoute, meetingId: string) =>
    route(new Request("https://app.test", { method: "POST" }), { params: { id: meetingId } });

  it("is served to the preacher but not to workspace members who can open the sermon", async () => {
    const { meeting, user, member } = await seedCoachedSermon();

    authMock.mockResolvedValue({ user: { id: user.id } });
    const ownerRes = await post(sermonCoachRoute, meeting.id);
    expect(ownerRes.status).toBe(200);
    expect((await ownerRes.json()).sermonCoach.overallScore).toBeGreaterThan(0);

    authMock.mockResolvedValue({ user: { id: member.id } });
    expect((await post(sermonCoachRoute, meeting.id)).status).toBe(404);
  });

  it("is stripped from the meeting detail a workspace member receives", async () => {
    const { meeting, user, member } = await seedCoachedSermon();

    expect((await getMeetingDetail(meeting.id, user.id))?.analysis?.sermonCoach).not.toBeNull();
    const asMember = await getMeetingDetail(meeting.id, member.id);
    expect(asMember).not.toBeNull();
    expect(asMember?.analysis?.sermonCoach).toBeNull();
    expect(asMember?.analysis?.summary).toBeTruthy();
  });

  it("never appears in a public share", async () => {
    const { meeting, user } = await seedCoachedSermon();
    const share = await createOrUpdateShare(meeting.id, user.id, { show_score: true });

    const result = await getPublicShare(share.token, undefined);
    // Coaching-only text (the share legitimately includes the transcript, so
    // sermon quotes themselves would appear anyway).
    const serialized = JSON.stringify(result);
    expect(serialized).toContain("meeting_title");
    expect(serialized).not.toContain("Vivid image");
    expect(serialized).not.toContain("Check the range of meaning");
    expect(serialized).not.toContain("bigIdeaClarity summary");
  });

  it("isn't replaced by Meeting Coach for sermons", async () => {
    const { meeting, user } = await seedCoachedSermon();
    authMock.mockResolvedValue({ user: { id: user.id } });
    expect((await post(meetingCoachRoute, meeting.id)).status).toBe(400);
  });
});
