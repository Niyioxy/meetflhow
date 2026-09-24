import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { GET as followUpCron } from "@/app/api/cron/follow-up-emails/route";
import { GET as reminderCron } from "@/app/api/cron/meeting-reminders/route";
import * as schema from "@/db/schema";
import { stableMessageId } from "@/lib/processing/effects";
import { resetDb } from "./helpers/test-db";
import { deferred, flush, mocks, resetMocks } from "./helpers/mocks";
import { seedMeeting, seedUser, testDb } from "./helpers/fixtures";

function cronRequest(secret = "cron-test-secret") {
  return new Request("https://app.test/api/cron", { headers: { authorization: `Bearer ${secret}` } });
}

async function seedDueFollowUp() {
  const user = await seedUser();
  const meeting = await seedMeeting({ userId: user.id, status: "ready" });
  const db = await testDb();
  const [email] = await db
    .insert(schema.scheduledFollowUpEmails)
    .values({
      meetingId: meeting.id,
      recipients: ["guest@example.com"],
      subject: "Follow-up",
      bodyHtml: "<p>Thanks</p>",
      sendAt: new Date(Date.now() - 60_000),
    })
    .returning();
  return email;
}

beforeEach(async () => {
  await resetDb();
  resetMocks();
});

describe("scheduled follow-up email cron", () => {
  it("sends each email once when two cron runs overlap", async () => {
    const email = await seedDueFollowUp();
    const gate = deferred();
    mocks.emailSend.mockImplementation(async () => {
      await gate.promise;
      return {};
    });

    const first = followUpCron(cronRequest());
    const second = followUpCron(cronRequest());
    await flush();
    gate.resolve();
    await Promise.all([first, second]);

    expect(mocks.emailSend).toHaveBeenCalledTimes(1);
    expect(mocks.emailSend.mock.calls[0][0]).toMatchObject({
      to: ["guest@example.com"],
      messageId: stableMessageId(`follow-up-email:${email.id}`),
    });

    const db = await testDb();
    const [after] = await db
      .select()
      .from(schema.scheduledFollowUpEmails)
      .where(eq(schema.scheduledFollowUpEmails.id, email.id));
    expect(after.sentAt).not.toBeNull();

    await followUpCron(cronRequest());
    expect(mocks.emailSend).toHaveBeenCalledTimes(1);
  });

  it("doesn't resend an email the ledger recorded as sent, even if sentAt was never set", async () => {
    const email = await seedDueFollowUp();
    const db = await testDb();
    await db.insert(schema.outboundEffects).values({
      effectKey: `follow-up-email:${email.id}`,
      kind: "follow_up_email",
      meetingId: email.meetingId,
      payload: { followUpEmailId: email.id },
      status: "succeeded",
      attemptCount: 1,
      completedAt: new Date(),
    });

    await followUpCron(cronRequest());

    expect(mocks.emailSend).not.toHaveBeenCalled();
    const [after] = await db
      .select()
      .from(schema.scheduledFollowUpEmails)
      .where(eq(schema.scheduledFollowUpEmails.id, email.id));
    expect(after.sentAt).not.toBeNull();
  });

  it("retries a failed send on a later run, without exceeding one successful send", async () => {
    const email = await seedDueFollowUp();
    mocks.emailSend.mockRejectedValueOnce(new Error("SMTP timeout"));

    await followUpCron(cronRequest());
    const db = await testDb();
    const [effect] = await db
      .select()
      .from(schema.outboundEffects)
      .where(eq(schema.outboundEffects.effectKey, `follow-up-email:${email.id}`));
    expect(effect.status).toBe("failed");
    expect(effect.lastError).toContain("SMTP timeout");

    // Backoff: an immediate re-run doesn't retry yet...
    await followUpCron(cronRequest());
    expect(mocks.emailSend).toHaveBeenCalledTimes(1);

    // ...but once it has elapsed, it does — and only once.
    await db
      .update(schema.outboundEffects)
      .set({ claimedAt: new Date(Date.now() - 10 * 60_000) })
      .where(eq(schema.outboundEffects.id, effect.id));
    await Promise.all([followUpCron(cronRequest()), followUpCron(cronRequest())]);
    expect(mocks.emailSend).toHaveBeenCalledTimes(2);
    await followUpCron(cronRequest());
    expect(mocks.emailSend).toHaveBeenCalledTimes(2);
  });

  it("rejects callers without the cron secret", async () => {
    await seedDueFollowUp();
    const res = await followUpCron(cronRequest("wrong"));
    expect(res.status).toBe(401);
    expect(mocks.emailSend).not.toHaveBeenCalled();
  });
});

describe("meeting reminder cron", () => {
  it("sends each reminder once when two cron runs overlap", async () => {
    const user = await seedUser();
    const db = await testDb();
    await db.insert(schema.scheduledMeetings).values({
      userId: user.id,
      title: "Board review",
      scheduledAt: new Date(Date.now() + 30 * 60_000),
    });

    const gate = deferred();
    mocks.emailSend.mockImplementation(async () => {
      await gate.promise;
      return {};
    });
    const runs = [reminderCron(cronRequest()), reminderCron(cronRequest())];
    await flush();
    gate.resolve();
    await Promise.all(runs);
    await reminderCron(cronRequest());

    expect(mocks.emailSend).toHaveBeenCalledTimes(1);
    expect(mocks.emailSend.mock.calls[0][0]).toMatchObject({ to: user.email });
    const [meeting] = await db.select().from(schema.scheduledMeetings);
    expect(meeting.reminderSentAt).not.toBeNull();
  });
});
