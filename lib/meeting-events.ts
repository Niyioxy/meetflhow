import { db } from "@/db";
import { meetingEvents, type MeetingEventType } from "@/db/schema";

/**
 * Records one step of a meeting's processing timeline. Swallows its own
 * errors — a logging failure must never take down the actual pipeline
 * step it's describing.
 */
export async function logMeetingEvent(
  meetingId: string,
  event: MeetingEventType,
  detail?: string
): Promise<void> {
  try {
    await db.insert(meetingEvents).values({ meetingId, event, detail: detail ?? null });
  } catch (error) {
    console.error("Failed to log meeting event", { meetingId, event, error });
  }
}
