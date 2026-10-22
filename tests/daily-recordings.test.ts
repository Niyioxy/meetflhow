import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { POST as dailyWebhook } from "@/app/api/webhooks/daily/route";
import { DELETE as deleteMeetingRoute } from "@/app/api/meetings/[id]/route";
import { processTranscript } from "@/lib/processing/transcribe";
import { deleteTransientAudio, dailyRecordingEventDetail } from "@/lib/processing/audio-cleanup";
import * as schema from "@/db/schema";
import { resetDb } from "./helpers/test-db";
import { mocks, resetMocks } from "./helpers/mocks";
import { getMeeting, seedMeeting, seedUser, seedWorkspace, testDb } from "./helpers/fixtures";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));

function signedDailyRequest(body: object) {
  const raw = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac("sha256", Buffer.from(process.env.DAILY_WEBHOOK_SECRET!, "base64"))
    .update(`${timestamp}.${raw}`)
    .digest("base64");
  return new Request("https://app.test/api/webhooks/daily", {
    method: "POST",
    headers: { "x-webhook-timestamp": timestamp, "x-webhook-signature": signature },
    body: raw,
  });
}

// The shape Daily documents: a recording_id and room, but no download URL.
const READY_WITHOUT_LINK = {
  type: "recording.ready-to-download",
  payload: { recording_id: "rec-1", room_name: "room-1", s3_key: "x/room-1/123" },
};

async function seedCallRoom() {
  const user = await seedUser();
  const workspace = await seedWorkspace(user.id);
  const db = await testDb();
  await db
    .insert(schema.callRooms)
    .values({ workspaceId: workspace.id, createdBy: user.id, dailyRoomName: "room-1" });
  return { user, workspace };
}

async function eventsFor(meetingId: string) {
  const db = await testDb();
  return db.select().from(schema.meetingEvents).where(eq(schema.meetingEvents.meetingId, meetingId));
}

beforeEach(async () => {
  await resetDb();
  resetMocks();
  authMock.mockReset();
});

describe("Daily recording webhook", () => {
  it("requests a download link when the payload has only a recording id, and remembers the recording", async () => {
    const { user } = await seedCallRoom();

    const res = await dailyWebhook(signedDailyRequest(READY_WITHOUT_LINK));

    expect(res.status).toBe(200);
    expect(mocks.dailyDownloadLink).toHaveBeenCalledWith("rec-1");
    const db = await testDb();
    const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.userId, user.id));
    expect(meeting.blobUrl).toBe("https://daily.test/signed/rec-1");
    expect(mocks.triggerInternalStep).toHaveBeenCalledWith(
      `/api/meetings/${meeting.id}/process-transcript`,
      expect.objectContaining({ blobUrl: "https://daily.test/signed/rec-1" })
    );
    const uploaded = (await eventsFor(meeting.id)).filter((e) => e.event === "uploaded");
    expect(uploaded.map((e) => e.detail)).toEqual([dailyRecordingEventDetail("rec-1")]);
  });

  it("still creates exactly one meeting and one recording note when Daily redelivers", async () => {
    const { user } = await seedCallRoom();

    await Promise.all([
      dailyWebhook(signedDailyRequest(READY_WITHOUT_LINK)),
      dailyWebhook(signedDailyRequest(READY_WITHOUT_LINK)),
      dailyWebhook(signedDailyRequest(READY_WITHOUT_LINK)),
    ]);

    const db = await testDb();
    const meetings = await db.select().from(schema.meetings).where(eq(schema.meetings.userId, user.id));
    expect(meetings).toHaveLength(1);
    const uploaded = (await eventsFor(meetings[0].id)).filter((e) => e.event === "uploaded");
    expect(uploaded).toHaveLength(1);
  });

  it("fails the delivery (so Daily retries) when the download link can't be fetched", async () => {
    const { user } = await seedCallRoom();
    mocks.dailyDownloadLink.mockRejectedValueOnce(new Error("Daily API error (500)"));

    const res = await dailyWebhook(signedDailyRequest(READY_WITHOUT_LINK));

    expect(res.status).toBe(500);
    const db = await testDb();
    expect(await db.select().from(schema.meetings).where(eq(schema.meetings.userId, user.id))).toHaveLength(0);
  });

  it("uses a download link when the payload includes one", async () => {
    await seedCallRoom();

    await dailyWebhook(
      signedDailyRequest({
        type: "recording.ready-to-download",
        payload: { room_name: "room-1", download_link: "https://daily.test/rec.mp4" },
      })
    );

    expect(mocks.dailyDownloadLink).not.toHaveBeenCalled();
    expect(mocks.triggerInternalStep).toHaveBeenCalledWith(
      expect.stringContaining("/process-transcript"),
      expect.objectContaining({ blobUrl: "https://daily.test/rec.mp4" })
    );
  });
});

describe("deleting source audio", () => {
  it("deletes a call recording from Daily once it has been transcribed", async () => {
    await seedCallRoom();
    await dailyWebhook(signedDailyRequest(READY_WITHOUT_LINK));
    const db = await testDb();
    const [meeting] = await db.select().from(schema.meetings);
    mocks.transcribeAudio.mockResolvedValue({ text: "Hello.", language: "en", utterances: [], durationSeconds: 30 });

    const outcome = await processTranscript(meeting.id, meeting.blobUrl!, meeting.userId, meeting.workspaceId);

    expect(outcome).toBe("handed_off");
    expect(mocks.dailyDeleteRecording).toHaveBeenCalledWith("rec-1");
    expect(mocks.blobDel).not.toHaveBeenCalled();
    expect((await getMeeting(meeting.id)).blobUrl).toBeNull();
  });

  it("deletes an uploaded file from blob storage, as before", async () => {
    const user = await seedUser();
    const meeting = await seedMeeting({ userId: user.id, status: "transcribing", blobUrl: "https://blob.test/a.webm" });
    mocks.transcribeAudio.mockResolvedValue({ text: "Hello.", language: "en", utterances: [], durationSeconds: 30 });

    await processTranscript(meeting.id, "https://blob.test/a.webm", user.id, null);

    expect(mocks.blobDel).toHaveBeenCalledWith("https://blob.test/a.webm");
    expect(mocks.dailyDeleteRecording).not.toHaveBeenCalled();
  });

  it("keeps a call recording when transcription fails, so it can be retried", async () => {
    await seedCallRoom();
    await dailyWebhook(signedDailyRequest(READY_WITHOUT_LINK));
    const db = await testDb();
    const [meeting] = await db.select().from(schema.meetings);
    mocks.transcribeAudio.mockRejectedValue(new Error("deepgram down"));

    expect(await processTranscript(meeting.id, meeting.blobUrl!, meeting.userId, meeting.workspaceId)).toBe("failed");

    expect(mocks.dailyDeleteRecording).not.toHaveBeenCalled();
  });

  it("never throws when storage can't be reached", async () => {
    const user = await seedUser();
    const meeting = await seedMeeting({ userId: user.id, status: "ready" });
    const db = await testDb();
    await db
      .insert(schema.meetingEvents)
      .values({ meetingId: meeting.id, event: "uploaded", detail: dailyRecordingEventDetail("rec-9") });
    mocks.dailyDeleteRecording.mockRejectedValueOnce(new Error("Daily is down"));

    await expect(deleteTransientAudio(meeting.id, null)).resolves.toBeUndefined();
  });

  it("retries the Daily delete when the meeting itself is deleted", async () => {
    const user = await seedUser();
    const meeting = await seedMeeting({ userId: user.id, status: "ready" });
    const db = await testDb();
    await db
      .insert(schema.meetingEvents)
      .values({ meetingId: meeting.id, event: "uploaded", detail: dailyRecordingEventDetail("rec-2") });
    authMock.mockResolvedValue({ user: { id: user.id } });

    const res = await deleteMeetingRoute(new Request("https://app.test/api/meetings/x", { method: "DELETE" }), {
      params: { id: meeting.id },
    });

    expect(res.status).toBe(200);
    expect(mocks.dailyDeleteRecording).toHaveBeenCalledWith("rec-2");
  });
});
