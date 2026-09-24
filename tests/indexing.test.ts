import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { indexTranscript, splitIntoChunks } from "@/lib/search/index-transcript";
import { transcriptChunks } from "@/db/schema";
import { resetDb } from "./helpers/test-db";
import { mocks, resetMocks } from "./helpers/mocks";
import { seedMeeting, seedTranscript, seedUser, testDb } from "./helpers/fixtures";

const LONG_TEXT = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");

async function chunksOf(transcriptId: string) {
  const db = await testDb();
  return db
    .select()
    .from(transcriptChunks)
    .where(eq(transcriptChunks.transcriptId, transcriptId))
    .orderBy(transcriptChunks.chunkIndex);
}

beforeEach(async () => {
  await resetDb();
  resetMocks();
});

describe("transcript indexing", () => {
  it("never duplicates chunks when the same transcript is indexed repeatedly or concurrently", async () => {
    const user = await seedUser();
    const meeting = await seedMeeting({ userId: user.id, status: "ready" });
    const transcript = await seedTranscript(meeting.id, LONG_TEXT);
    const expected = splitIntoChunks(LONG_TEXT).length;
    expect(expected).toBeGreaterThan(2);

    await indexTranscript(transcript.id, meeting.id, LONG_TEXT);
    await indexTranscript(transcript.id, meeting.id, LONG_TEXT);
    await Promise.all([
      indexTranscript(transcript.id, meeting.id, LONG_TEXT),
      indexTranscript(transcript.id, meeting.id, LONG_TEXT),
    ]);

    const chunks = await chunksOf(transcript.id);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(Array.from({ length: expected }, (_, i) => i));
    expect(mocks.embedChunks).toHaveBeenCalledTimes(4);
  });

  it("replaces the old chunks when the text gets shorter", async () => {
    const user = await seedUser();
    const meeting = await seedMeeting({ userId: user.id, status: "ready" });
    const transcript = await seedTranscript(meeting.id, LONG_TEXT);

    await indexTranscript(transcript.id, meeting.id, LONG_TEXT);
    await indexTranscript(transcript.id, meeting.id, "A short corrected transcript.");

    const chunks = await chunksOf(transcript.id);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("A short corrected transcript.");
  });
});
