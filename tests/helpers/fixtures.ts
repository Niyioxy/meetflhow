import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getTestDb } from "./test-db";
import * as schema from "@/db/schema";
import type { MeetingStatus, WebhookEvent } from "@/db/schema";

export async function testDb() {
  return (await getTestDb()).db;
}

export async function seedUser(email = `user-${randomUUID()}@example.com`) {
  const db = await testDb();
  const [user] = await db.insert(schema.users).values({ email, name: "Owner" }).returning();
  return user;
}

export async function seedWorkspace(ownerId: string) {
  const db = await testDb();
  const [workspace] = await db
    .insert(schema.workspaces)
    .values({ name: "Acme", slug: `acme-${randomUUID()}`, ownerId })
    .returning();
  return workspace;
}

export async function seedWebhook(workspaceId: string, events: WebhookEvent[], url = "https://hooks.example.com/in") {
  const db = await testDb();
  const [webhook] = await db
    .insert(schema.webhooks)
    .values({ workspaceId, name: "Hook", url, events, secret: "whsec" })
    .returning();
  return webhook;
}

export async function seedMeeting(values: {
  userId: string;
  workspaceId?: string | null;
  status: MeetingStatus;
  blobUrl?: string | null;
  title?: string;
}) {
  const db = await testDb();
  const [meeting] = await db
    .insert(schema.meetings)
    .values({
      userId: values.userId,
      workspaceId: values.workspaceId ?? null,
      title: values.title ?? "Weekly sync",
      status: values.status,
      blobUrl: values.blobUrl ?? null,
    })
    .returning();
  return meeting;
}

export async function seedTranscript(meetingId: string, fullText = "Hello team, let's ship the deck.") {
  const db = await testDb();
  const [transcript] = await db
    .insert(schema.transcripts)
    .values({ meetingId, fullText, wordCount: fullText.split(/\s+/).length })
    .returning();
  return transcript;
}

/** A user with a workspace that has one webhook subscribed to the pipeline's events. */
export async function seedPipelineWorkspace() {
  const user = await seedUser();
  const workspace = await seedWorkspace(user.id);
  const webhook = await seedWebhook(workspace.id, [
    "meeting.completed",
    "action_item.created",
    "meeting.scored",
  ]);
  return { user, workspace, webhook };
}

export async function getMeeting(meetingId: string) {
  const db = await testDb();
  const [meeting] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, meetingId));
  return meeting;
}

export async function rowsFor(meetingId: string) {
  const db = await testDb();
  const [transcripts, analysis, actionItems, tasks, effects, events] = await Promise.all([
    db.select().from(schema.transcripts).where(eq(schema.transcripts.meetingId, meetingId)),
    db.select().from(schema.analysis).where(eq(schema.analysis.meetingId, meetingId)),
    db.select().from(schema.actionItems).where(eq(schema.actionItems.meetingId, meetingId)),
    db.select().from(schema.tasks).where(eq(schema.tasks.meetingId, meetingId)),
    db.select().from(schema.outboundEffects).where(eq(schema.outboundEffects.meetingId, meetingId)),
    db.select().from(schema.meetingEvents).where(eq(schema.meetingEvents.meetingId, meetingId)),
  ]);
  return { transcripts, analysis, actionItems, tasks, effects, events };
}
