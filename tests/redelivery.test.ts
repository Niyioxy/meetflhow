import crypto from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { POST as dailyWebhook } from "@/app/api/webhooks/daily/route";
import { processTranscript } from "@/lib/processing/transcribe";
import { enqueueEffects } from "@/lib/processing/effects";
import { dispatchEffects } from "@/lib/processing/dispatch";
import { webhookEffects } from "@/lib/webhooks";
import * as schema from "@/db/schema";
import { resetDb } from "./helpers/test-db";
import { fetchCallsTo, mocks, resetMocks } from "./helpers/mocks";
import { seedMeeting, seedPipelineWorkspace, seedUser, seedWorkspace, testDb } from "./helpers/fixtures";

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

const RECORDING_READY = {
  type: "recording.ready-to-download",
  payload: { room_name: "room-1", download_link: "https://daily.test/rec.mp4" },
};

function transcriptHandOffs() {
  return mocks.triggerInternalStep.mock.calls.filter(([path]) =>
    String(path).endsWith("/process-transcript")
  );
}

async function seedCallRoom() {
  const user = await seedUser();
  const workspace = await seedWorkspace(user.id);
  const db = await testDb();
  const [room] = await db
    .insert(schema.callRooms)
    .values({ workspaceId: workspace.id, createdBy: user.id, dailyRoomName: "room-1" })
    .returning();
  return { user, room };
}

beforeEach(async () => {
  await resetDb();
  resetMocks();
});

describe("Daily recording webhook redelivery", () => {
  it("creates exactly one meeting and transcribes once, however often Daily delivers", async () => {
    const { user, room } = await seedCallRoom();
    const db = await testDb();

    const responses = await Promise.all([
      dailyWebhook(signedDailyRequest(RECORDING_READY)),
      dailyWebhook(signedDailyRequest(RECORDING_READY)),
      dailyWebhook(signedDailyRequest(RECORDING_READY)),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);

    const created = await db.select().from(schema.meetings).where(eq(schema.meetings.userId, user.id));
    expect(created).toHaveLength(1);
    const [linkedRoom] = await db.select().from(schema.callRooms).where(eq(schema.callRooms.id, room.id));
    expect(linkedRoom.meetingId).toBe(created[0].id);

    // Each delivery may re-hand-off while the meeting awaits transcription;
    // the transcription stage's claim turns the extras into no-ops.
    const handOffs = transcriptHandOffs();
    expect(handOffs.length).toBeGreaterThanOrEqual(1);
    expect(handOffs.every(([path]) => path === `/api/meetings/${created[0].id}/process-transcript`)).toBe(
      true
    );
    const outcomes = await Promise.all(
      handOffs.map(([, body]) => {
        const { blobUrl, userId, workspaceId } = body as Record<string, string>;
        return processTranscript(created[0].id, blobUrl, userId, workspaceId);
      })
    );
    expect(outcomes.filter((o) => o === "handed_off")).toHaveLength(1);
    expect(mocks.transcribeAudio).toHaveBeenCalledTimes(1);

    // Once transcription is done, a late redelivery changes nothing.
    mocks.triggerInternalStep.mockClear();
    await dailyWebhook(signedDailyRequest(RECORDING_READY));
    expect(transcriptHandOffs()).toHaveLength(0);
    expect(
      await db.select().from(schema.meetings).where(eq(schema.meetings.userId, user.id))
    ).toHaveLength(1);
  });

  it("recovers a lost hand-off when Daily redelivers", async () => {
    const { user } = await seedCallRoom();
    const db = await testDb();

    mocks.triggerInternalStep.mockRejectedValueOnce(new Error("hand-off failed"));
    expect((await dailyWebhook(signedDailyRequest(RECORDING_READY))).status).toBe(500);
    expect((await dailyWebhook(signedDailyRequest(RECORDING_READY))).status).toBe(200);

    const created = await db.select().from(schema.meetings).where(eq(schema.meetings.userId, user.id));
    expect(created).toHaveLength(1);
    expect(transcriptHandOffs()).toHaveLength(2);
  });
});

describe("outbound webhook deliveries", () => {
  async function queueCompletedWebhook() {
    const { user, workspace, webhook } = await seedPipelineWorkspace();
    const meeting = await seedMeeting({ userId: user.id, workspaceId: workspace.id, status: "ready" });
    const specs = await webhookEffects(workspace.id, meeting.id, "meeting.completed", [
      { key: meeting.id, data: { meeting_id: meeting.id } },
    ]);
    await enqueueEffects(specs);
    return { webhook, meeting, specs };
  }

  function deliveryIds(url: string) {
    return fetchCallsTo(url).map(
      ([, init]) => ((init as RequestInit).headers as Record<string, string>)["X-MeetFlhow-Delivery-Id"]
    );
  }

  it("delivers once when several dispatchers race, and enqueueing again is a no-op", async () => {
    const { webhook, specs } = await queueCompletedWebhook();

    await Promise.all([dispatchEffects(), dispatchEffects(), dispatchEffects()]);
    await enqueueEffects(specs);
    await dispatchEffects();

    expect(fetchCallsTo(webhook.url)).toHaveLength(1);
  });

  it("retries a failed delivery with the same delivery id, and never re-sends a delivered one", async () => {
    const { webhook, meeting } = await queueCompletedWebhook();
    mocks.fetch.mockResolvedValueOnce(new Response("nope", { status: 500 }));

    await dispatchEffects();
    await dispatchEffects(); // still backing off
    expect(fetchCallsTo(webhook.url)).toHaveLength(1);

    const db = await testDb();
    await db
      .update(schema.outboundEffects)
      .set({ claimedAt: sql`now() - interval '5 minutes'` })
      .where(eq(schema.outboundEffects.meetingId, meeting.id));
    await dispatchEffects();
    await dispatchEffects();

    const ids = deliveryIds(webhook.url);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    const [effect] = await db
      .select()
      .from(schema.outboundEffects)
      .where(eq(schema.outboundEffects.meetingId, meeting.id));
    expect(effect.status).toBe("succeeded");
    expect(effect.attemptCount).toBe(2);
  });

  it("re-sends a delivery whose worker died mid-send only after its lease expires", async () => {
    const { webhook, meeting } = await queueCompletedWebhook();
    const db = await testDb();
    await db
      .update(schema.outboundEffects)
      .set({ status: "sending", claimedAt: sql`now()`, attemptCount: 1 })
      .where(eq(schema.outboundEffects.meetingId, meeting.id));

    await dispatchEffects();
    expect(fetchCallsTo(webhook.url)).toHaveLength(0);

    await db
      .update(schema.outboundEffects)
      .set({ claimedAt: sql`now() - interval '11 minutes'` })
      .where(eq(schema.outboundEffects.meetingId, meeting.id));
    await dispatchEffects();
    expect(fetchCallsTo(webhook.url)).toHaveLength(1);
  });
});
