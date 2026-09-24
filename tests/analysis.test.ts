import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { runAllMeetingAnalyses } from "@/lib/meetings";
import { requeueMeeting } from "@/lib/processing/lease";
import * as schema from "@/db/schema";
import { getTestDb, resetDb } from "./helpers/test-db";
import { deferred, fetchCallsTo, flush, mocks, resetMocks } from "./helpers/mocks";
import {
  getMeeting,
  rowsFor,
  seedMeeting,
  seedPipelineWorkspace,
  seedTranscript,
  testDb,
} from "./helpers/fixtures";

const TRANSCRIPT = "Hello team, let's ship the deck.";

async function seedQueuedAnalysis() {
  const { user, workspace, webhook } = await seedPipelineWorkspace();
  const meeting = await seedMeeting({ userId: user.id, workspaceId: workspace.id, status: "analyzing" });
  await seedTranscript(meeting.id, TRANSCRIPT);
  return { user, workspace, webhook, meeting };
}

function deliveredEvents(webhookUrl: string) {
  return fetchCallsTo(webhookUrl).map(([, init]) => {
    const headers = (init as RequestInit).headers as Record<string, string>;
    return { event: headers["X-MeetFlhow-Event"], deliveryId: headers["X-MeetFlhow-Delivery-Id"] };
  });
}

/** Every action item has exactly one task mirroring it, and no task is unlinked. */
function expectOneTaskPerActionItem(rows: Awaited<ReturnType<typeof rowsFor>>) {
  const linked = rows.tasks.map((t) => t.actionItemId).sort();
  expect(linked).toEqual(rows.actionItems.map((i) => i.id).sort());
}

beforeEach(async () => {
  await resetDb();
  resetMocks();
});

describe("analysis stage", () => {
  it("runs Gemini once and notifies once when two analysis requests race", async () => {
    const { meeting, webhook } = await seedQueuedAnalysis();

    const gate = deferred();
    mocks.analyzeTranscript.mockImplementation(async () => {
      await gate.promise;
      const { ANALYSIS_RESULT } = await import("./helpers/mocks");
      return ANALYSIS_RESULT;
    });

    const first = runAllMeetingAnalyses(meeting.id, TRANSCRIPT);
    const second = runAllMeetingAnalyses(meeting.id, TRANSCRIPT);
    await flush();
    gate.resolve();
    const outcomes = await Promise.all([first, second]);

    expect(outcomes.sort()).toEqual(["ready", "skipped"]);
    expect(mocks.analyzeTranscript).toHaveBeenCalledTimes(1);

    const rows = await rowsFor(meeting.id);
    expect(rows.analysis).toHaveLength(1);
    expect(rows.analysis[0].coreCompletedAt).not.toBeNull();
    expect(rows.actionItems).toHaveLength(2);
    expectOneTaskPerActionItem(rows);
    expect(rows.effects.every((e) => e.status === "succeeded")).toBe(true);

    const delivered = deliveredEvents(webhook.url);
    expect(delivered.map((d) => d.event).sort()).toEqual([
      "action_item.created",
      "action_item.created",
      "meeting.completed",
      "meeting.scored",
    ]);
    expect(new Set(delivered.map((d) => d.deliveryId)).size).toBe(4);

    const after = await getMeeting(meeting.id);
    expect(after.status).toBe("ready");
    expect(after.processingAttemptId).toBeNull();
  });

  it("doesn't repeat Gemini, rows or deliveries when a finished analysis is run again", async () => {
    const { meeting, webhook } = await seedQueuedAnalysis();
    expect(await runAllMeetingAnalyses(meeting.id, TRANSCRIPT)).toBe("ready");
    const deliveredBefore = fetchCallsTo(webhook.url).length;

    // Already ready: a duplicate trigger can't claim it at all.
    expect(await runAllMeetingAnalyses(meeting.id, TRANSCRIPT)).toBe("skipped");

    // Even forced back through the stage, the completed core and its
    // deliveries are recognised rather than redone.
    const db = await testDb();
    await db.update(schema.meetings).set({ status: "failed" }).where(eq(schema.meetings.id, meeting.id));
    expect(await requeueMeeting(meeting.id, "analyzing")).toBe(true);
    expect(await runAllMeetingAnalyses(meeting.id, TRANSCRIPT)).toBe("ready");

    expect(mocks.analyzeTranscript).toHaveBeenCalledTimes(1);
    expect(mocks.coach).toHaveBeenCalledTimes(1);
    const rows = await rowsFor(meeting.id);
    expect(rows.actionItems).toHaveLength(2);
    expect(rows.tasks).toHaveLength(2);
    expect(fetchCallsTo(webhook.url)).toHaveLength(deliveredBefore);
  });

  it("rolls back all core output if persisting fails partway, then completes cleanly on retry", async () => {
    const { meeting, webhook } = await seedQueuedAnalysis();
    const { client } = await getTestDb();

    // Fail the core transaction at its last write (the tasks), after the
    // summary and action items have been written within it.
    await client.exec(`
      create function fail_task_insert() returns trigger language plpgsql as $$
      begin raise exception 'simulated crash while saving tasks'; end; $$;
      create trigger fail_task_insert before insert on tasks
        for each row execute function fail_task_insert();
    `);

    await expect(runAllMeetingAnalyses(meeting.id, TRANSCRIPT)).rejects.toThrow("Meeting analysis failed");

    let rows = await rowsFor(meeting.id);
    expect(rows.analysis[0].summary).toBe("");
    expect(rows.analysis[0].coreCompletedAt).toBeNull();
    expect(rows.actionItems).toHaveLength(0);
    expect(rows.tasks).toHaveLength(0);
    expect(deliveredEvents(webhook.url).map((d) => d.event)).not.toContain("action_item.created");
    expect((await getMeeting(meeting.id)).status).toBe("failed");

    await client.exec("drop trigger fail_task_insert on tasks; drop function fail_task_insert();");
    expect(await requeueMeeting(meeting.id, "analyzing")).toBe(true);
    expect(await runAllMeetingAnalyses(meeting.id, TRANSCRIPT)).toBe("ready");

    rows = await rowsFor(meeting.id);
    expect(rows.analysis[0].summary).toBe("We agreed to ship the deck.");
    expect(rows.actionItems).toHaveLength(2);
    expectOneTaskPerActionItem(rows);
    expect(
      deliveredEvents(webhook.url).filter((d) => d.event === "action_item.created")
    ).toHaveLength(2);
  });

  it("stops an attempt that lost its lease from writing anything", async () => {
    const { meeting, webhook } = await seedQueuedAnalysis();
    const db = await testDb();

    const gate = deferred();
    mocks.analyzeTranscript.mockImplementation(async () => {
      await gate.promise;
      const { ANALYSIS_RESULT } = await import("./helpers/mocks");
      return ANALYSIS_RESULT;
    });

    const run = runAllMeetingAnalyses(meeting.id, TRANSCRIPT);
    await flush();
    // While Gemini is still working, another worker takes the meeting over
    // (as after a lease expiry).
    const usurper = randomUUID();
    await db
      .update(schema.meetings)
      .set({ processingAttemptId: usurper, processingStartedAt: sql`now()` })
      .where(eq(schema.meetings.id, meeting.id));
    gate.resolve();

    expect(await run).toBe("superseded");
    const rows = await rowsFor(meeting.id);
    expect(rows.actionItems).toHaveLength(0);
    expect(rows.tasks).toHaveLength(0);
    expect(rows.analysis[0].summary).toBe("");
    expect(deliveredEvents(webhook.url).map((d) => d.event)).not.toContain("meeting.completed");

    const after = await getMeeting(meeting.id);
    expect(after.processingAttemptId).toBe(usurper);
    expect(after.status).toBe("analyzing");
  });
});

describe("retry after partial output from the old, non-transactional pipeline", () => {
  async function seedPartial(withActionItems: boolean) {
    const { user, workspace } = await seedPipelineWorkspace();
    const meeting = await seedMeeting({ userId: user.id, workspaceId: workspace.id, status: "failed" });
    await seedTranscript(meeting.id, TRANSCRIPT);
    const db = await testDb();
    await db.insert(schema.analysis).values({ meetingId: meeting.id, summary: "Summary from the crashed run" });

    if (withActionItems) {
      // Two identical action items; the crash happened after the first
      // one's task was created (and linked by the migration).
      const items = await db
        .insert(schema.actionItems)
        .values([
          { meetingId: meeting.id, task: "Follow up", owner: "Ana" },
          { meetingId: meeting.id, task: "Follow up", owner: "Ben" },
        ])
        .returning();
      await db.insert(schema.tasks).values({
        userId: user.id,
        meetingId: meeting.id,
        actionItemId: items[0].id,
        title: "Follow up",
      });
    }
    return meeting;
  }

  it("completes the missing tasks from what's stored, without re-running Gemini", async () => {
    const meeting = await seedPartial(true);

    expect(await requeueMeeting(meeting.id, "analyzing")).toBe(true);
    expect(await runAllMeetingAnalyses(meeting.id, TRANSCRIPT)).toBe("ready");

    expect(mocks.analyzeTranscript).not.toHaveBeenCalled();
    const rows = await rowsFor(meeting.id);
    expect(rows.analysis[0].summary).toBe("Summary from the crashed run");
    expect(rows.analysis[0].coreCompletedAt).not.toBeNull();
    expect(rows.actionItems).toHaveLength(2);
    expectOneTaskPerActionItem(rows);
  });

  it("re-runs Gemini when the crashed run saved a summary but no action items", async () => {
    const meeting = await seedPartial(false);

    expect(await requeueMeeting(meeting.id, "analyzing")).toBe(true);
    expect(await runAllMeetingAnalyses(meeting.id, TRANSCRIPT)).toBe("ready");

    expect(mocks.analyzeTranscript).toHaveBeenCalledTimes(1);
    const rows = await rowsFor(meeting.id);
    expect(rows.analysis).toHaveLength(1);
    expect(rows.analysis[0].summary).toBe("We agreed to ship the deck.");
    expect(rows.actionItems).toHaveLength(2);
    expectOneTaskPerActionItem(rows);
  });
});
