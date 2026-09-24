import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { processTranscript } from "@/lib/processing/transcribe";
import { meetings } from "@/db/schema";
import { resetDb } from "./helpers/test-db";
import { deferred, flush, mocks, resetMocks } from "./helpers/mocks";
import { getMeeting, rowsFor, seedMeeting, seedTranscript, seedUser, testDb } from "./helpers/fixtures";

const BLOB_URL = "https://blob.test/recording.webm";

function analysisHandOffs(meetingId: string) {
  return mocks.triggerInternalStep.mock.calls.filter(
    ([path]) => path === `/api/meetings/${meetingId}/process-analysis`
  );
}

beforeEach(async () => {
  await resetDb();
  resetMocks();
});

describe("transcription stage", () => {
  it("transcribes once when two requests for the same meeting race", async () => {
    const user = await seedUser();
    const meeting = await seedMeeting({ userId: user.id, status: "transcribing", blobUrl: BLOB_URL });

    const gate = deferred();
    mocks.transcribeAudio.mockImplementation(async () => {
      await gate.promise;
      return { text: "Hello team.", language: "en", utterances: [], durationSeconds: 61.4 };
    });

    const first = processTranscript(meeting.id, BLOB_URL, user.id, null);
    const second = processTranscript(meeting.id, BLOB_URL, user.id, null);
    await flush();
    gate.resolve();
    const outcomes = await Promise.all([first, second]);

    expect(outcomes.sort()).toEqual(["handed_off", "skipped"]);
    expect(mocks.transcribeAudio).toHaveBeenCalledTimes(1);
    expect(analysisHandOffs(meeting.id)).toHaveLength(1);

    const rows = await rowsFor(meeting.id);
    expect(rows.transcripts).toHaveLength(1);

    const after = await getMeeting(meeting.id);
    expect(after.status).toBe("analyzing");
    expect(after.processingAttemptId).toBeNull();
    expect(after.blobUrl).toBeNull();
    expect(after.durationSeconds).toBe(61);

    // A late duplicate (a retried hand-off, a redelivered webhook) is a no-op.
    expect(await processTranscript(meeting.id, BLOB_URL, user.id, null)).toBe("skipped");
    expect(mocks.transcribeAudio).toHaveBeenCalledTimes(1);
  });

  it("leaves a live lease alone but reclaims one whose worker died", async () => {
    const user = await seedUser();
    const meeting = await seedMeeting({ userId: user.id, status: "transcribing", blobUrl: BLOB_URL });
    const db = await testDb();

    await db
      .update(meetings)
      .set({ processingAttemptId: randomUUID(), processingStartedAt: sql`now()` })
      .where(eq(meetings.id, meeting.id));
    expect(await processTranscript(meeting.id, BLOB_URL, user.id, null)).toBe("skipped");

    await db
      .update(meetings)
      .set({ processingStartedAt: sql`now() - interval '20 minutes'` })
      .where(eq(meetings.id, meeting.id));
    expect(await processTranscript(meeting.id, BLOB_URL, user.id, null)).toBe("handed_off");
    expect(mocks.transcribeAudio).toHaveBeenCalledTimes(1);
  });

  it("reuses a transcript an earlier attempt stored instead of transcribing again", async () => {
    const user = await seedUser();
    const meeting = await seedMeeting({ userId: user.id, status: "transcribing", blobUrl: BLOB_URL });
    await seedTranscript(meeting.id, "Stored earlier.");

    expect(await processTranscript(meeting.id, BLOB_URL, user.id, null)).toBe("handed_off");

    expect(mocks.transcribeAudio).not.toHaveBeenCalled();
    expect((await rowsFor(meeting.id)).transcripts).toHaveLength(1);
    expect(analysisHandOffs(meeting.id)[0][1]).toMatchObject({ transcriptText: "Stored earlier." });
  });

  it("marks the meeting failed and keeps the audio for a retry when transcription fails", async () => {
    const user = await seedUser();
    const meeting = await seedMeeting({ userId: user.id, status: "transcribing", blobUrl: BLOB_URL });
    mocks.transcribeAudio.mockRejectedValue(new Error("Deepgram is down"));

    expect(await processTranscript(meeting.id, BLOB_URL, user.id, null)).toBe("failed");

    const after = await getMeeting(meeting.id);
    expect(after.status).toBe("failed");
    expect(after.processingAttemptId).toBeNull();
    expect(after.blobUrl).toBe(BLOB_URL);
    expect(mocks.blobDel).not.toHaveBeenCalled();
    expect((await rowsFor(meeting.id)).transcripts).toHaveLength(0);
  });
});
