import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db";
import { scheduledMeetings } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { MeetingCalendar } from "@/components/scheduler/meeting-calendar";
import { Plus } from "lucide-react";

export default async function CalendarPage() {
  const session = await auth();
  const userId = session!.user.id;

  const rows = await db
    .select()
    .from(scheduledMeetings)
    .where(eq(scheduledMeetings.userId, userId))
    .orderBy(desc(scheduledMeetings.scheduledAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Your scheduled meetings.</p>
        </div>
        <Button asChild>
          <Link href="/schedule-meeting">
            <Plus className="mr-2 h-4 w-4" />
            Schedule meeting
          </Link>
        </Button>
      </div>

      <MeetingCalendar
        meetings={rows.map((m) => ({
          id: m.id,
          title: m.title,
          platform: m.platform,
          scheduledAt: m.scheduledAt.toISOString(),
          durationMinutes: m.durationMinutes,
          meetLink: m.meetLink,
          notes: m.notes,
        }))}
      />
    </div>
  );
}
