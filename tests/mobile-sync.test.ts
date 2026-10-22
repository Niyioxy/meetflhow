import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { POST as syncRoute } from "@/app/api/mobile/sync/route";
import { signMobileToken } from "@/lib/mobile-auth";
import * as schema from "@/db/schema";
import { resetDb } from "./helpers/test-db";
import { mocks, resetMocks } from "./helpers/mocks";
import { seedUser, testDb } from "./helpers/fixtures";

beforeEach(async () => {
  await resetDb();
  resetMocks();
});

const recording = {
  id: "local-1",
  title: "Standup",
  platform: "other",
  recorded_at: "2026-10-01T09:00:00.000Z",
  duration: 61,
  audio_base64: Buffer.from("fake audio").toString("base64"),
};

async function sync(token: string | null, body: unknown = { recordings: [recording] }) {
  const res = await syncRoute(
    new Request("https://app.test/api/mobile/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, json: await res.json() };
}

async function userMeetings(userId: string) {
  const db = await testDb();
  return db.select().from(schema.meetings).where(eq(schema.meetings.userId, userId));
}

describe("mobile sync", () => {
  it("rejects requests without a valid mobile token", async () => {
    expect((await sync(null)).status).toBe(401);
    expect((await sync("not-a-jwt")).status).toBe(401);
  });

  it("stores the audio and hands the meeting to transcription", async () => {
    const user = await seedUser();
    const { status, json } = await sync(await signMobileToken(user.id));

    expect(status).toBe(200);
    expect(json.results).toEqual([
      { localId: "local-1", meetingId: expect.any(String), status: "queued" },
    ]);
    const [meeting] = await userMeetings(user.id);
    expect(meeting.status).toBe("transcribing");
    expect(meeting.blobUrl).toMatch(/^https:\/\/blob\.test\//);
    expect(meeting.createdAt.toISOString()).toBe(recording.recorded_at);
    expect(mocks.triggerInternalStep).toHaveBeenCalledWith(
      `/api/meetings/${meeting.id}/process-transcript`,
      { blobUrl: meeting.blobUrl, userId: user.id, workspaceId: null }
    );
  });

  it("doesn't create a duplicate meeting when a recording is re-sent", async () => {
    const user = await seedUser();
    const token = await signMobileToken(user.id);

    const first = await sync(token);
    const second = await sync(token);

    expect(second.json.results[0]).toEqual({ ...first.json.results[0], status: "queued" });
    expect(await userMeetings(user.id)).toHaveLength(1);
    expect(mocks.blobPut).toHaveBeenCalledTimes(1);
    expect(mocks.triggerInternalStep).toHaveBeenCalledTimes(1);
  });

  it("marks a failed hand-off and retries it on the same meeting", async () => {
    const user = await seedUser();
    const token = await signMobileToken(user.id);
    mocks.triggerInternalStep.mockRejectedValueOnce(new Error("hand-off down"));

    const first = await sync(token);
    expect(first.json.results[0].status).toBe("upload_failed");
    expect((await userMeetings(user.id))[0].status).toBe("failed");

    const second = await sync(token);
    expect(second.json.results[0]).toEqual({ ...first.json.results[0], status: "queued" });
    const meetings = await userMeetings(user.id);
    expect(meetings).toHaveLength(1);
    expect(meetings[0].status).toBe("transcribing");
    expect(mocks.blobPut).toHaveBeenCalledTimes(1);
  });

  it("leaves no meeting behind when the audio upload fails", async () => {
    const user = await seedUser();
    mocks.blobPut.mockRejectedValueOnce(new Error("blob down"));

    const { json } = await sync(await signMobileToken(user.id));

    expect(json.results[0].status).toBe("error");
    expect(await userMeetings(user.id)).toHaveLength(0);
  });
});

describe("mobile sync with a direct-to-blob upload", () => {
  const blobUrlFor = (userId: string, name = "local-1-abc123.m4a") =>
    `https://store1.public.blob.vercel-storage.com/mobile-sync/${userId}/${name}`;
  const { audio_base64: _legacyAudio, ...metadata } = recording;

  it("uses the uploaded blob without re-uploading the audio", async () => {
    const user = await seedUser();
    const blob_url = blobUrlFor(user.id);

    const { status, json } = await sync(await signMobileToken(user.id), {
      recordings: [{ ...metadata, blob_url }],
    });

    expect(status).toBe(200);
    expect(json.results[0].status).toBe("queued");
    const [meeting] = await userMeetings(user.id);
    expect(meeting.blobUrl).toBe(blob_url);
    expect(mocks.blobPut).not.toHaveBeenCalled();
    expect(mocks.triggerInternalStep).toHaveBeenCalledWith(
      `/api/meetings/${meeting.id}/process-transcript`,
      { blobUrl: blob_url, userId: user.id, workspaceId: null }
    );
  });

  it("refuses a blob that isn't under the caller's own upload path", async () => {
    const user = await seedUser();
    const other = await seedUser();

    const { json } = await sync(await signMobileToken(user.id), {
      recordings: [
        { ...metadata, id: "a", blob_url: blobUrlFor(other.id) },
        { ...metadata, id: "b", blob_url: `https://evil.example.com/mobile-sync/${user.id}/x.m4a` },
        {
          ...metadata,
          id: "c",
          blob_url: `https://store1.public.blob.vercel-storage.com/mobile-sync/${user.id}/../${other.id}/x.m4a`,
        },
      ],
    });

    expect(json.results.map((r: { status: string }) => r.status)).toEqual(["error", "error", "error"]);
    expect(await userMeetings(user.id)).toHaveLength(0);
    expect(mocks.triggerInternalStep).not.toHaveBeenCalled();
  });

  it("requires either audio or a blob URL", async () => {
    const user = await seedUser();

    const { status } = await sync(await signMobileToken(user.id), { recordings: [metadata] });

    expect(status).toBe(400);
  });

  it("deletes a second upload of a recording the server already has", async () => {
    const user = await seedUser();
    const token = await signMobileToken(user.id);
    const first = blobUrlFor(user.id, "local-1-first.m4a");
    const second = blobUrlFor(user.id, "local-1-second.m4a");

    await sync(token, { recordings: [{ ...metadata, blob_url: first }] });
    const retry = await sync(token, { recordings: [{ ...metadata, blob_url: second }] });

    expect(retry.json.results[0].status).toBe("queued");
    expect(await userMeetings(user.id)).toHaveLength(1);
    expect(mocks.blobDel).toHaveBeenCalledWith(second);
    expect(mocks.blobDel).not.toHaveBeenCalledWith(first);
    expect(mocks.triggerInternalStep).toHaveBeenCalledTimes(1);
  });
});
