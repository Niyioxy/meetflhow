import { NextResponse } from "next/server";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { scheduledMeetings, users } from "@/db/schema";
import { sendMeetingReminderEmail } from "@/lib/email/reminder";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const windowStart = new Date(now + 25 * 60_000);
  const windowEnd = new Date(now + 35 * 60_000);

  const due = await db
    .select({
      meeting: scheduledMeetings,
      userEmail: users.email,
    })
    .from(scheduledMeetings)
    .innerJoin(users, eq(scheduledMeetings.userId, users.id))
    .where(
      and(
        gte(scheduledMeetings.scheduledAt, windowStart),
        lte(scheduledMeetings.scheduledAt, windowEnd),
        isNull(scheduledMeetings.reminderSentAt)
      )
    );

  let sent = 0;
  for (const { meeting, userEmail } of due) {
    try {
      await sendMeetingReminderEmail({
        to: userEmail,
        title: meeting.title,
        scheduledAt: meeting.scheduledAt,
        platform: meeting.platform,
        meetLink: meeting.meetLink,
      });
      await db
        .update(scheduledMeetings)
        .set({ reminderSentAt: new Date() })
        .where(eq(scheduledMeetings.id, meeting.id));
      sent += 1;
    } catch (error) {
      console.error(`Failed to send reminder for meeting ${meeting.id}`, error);
    }
  }

  return NextResponse.json({ checked: due.length, sent });
}
