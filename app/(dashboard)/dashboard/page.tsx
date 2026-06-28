import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetings, scheduledMeetings, tasks, actionItems } from "@/db/schema";
import { and, desc, eq, gte, lte, inArray } from "drizzle-orm";
import { startOfDay, endOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { MeetingsList } from "@/components/dashboard/meetings-list";
import { TodaysMeetings } from "@/components/dashboard/todays-meetings";
import { StatCard } from "@/components/dashboard/stat-card";
import { Mic, UploadCloud, Video, ListChecks, CheckCircle2, Clock } from "lucide-react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const firstName = session!.user.name?.split(" ")[0] ?? "there";

  const rows = await db
    .select()
    .from(meetings)
    .where(eq(meetings.userId, userId))
    .orderBy(desc(meetings.createdAt));

  const now = new Date();
  const todaysScheduled = await db
    .select()
    .from(scheduledMeetings)
    .where(
      and(
        eq(scheduledMeetings.userId, userId),
        gte(scheduledMeetings.scheduledAt, startOfDay(now)),
        lte(scheduledMeetings.scheduledAt, endOfDay(now))
      )
    )
    .orderBy(scheduledMeetings.scheduledAt);

  const userTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
  const meetingIds = rows.map((m) => m.id);
  const openActionItems = meetingIds.length
    ? await db
        .select()
        .from(actionItems)
        .where(and(inArray(actionItems.meetingId, meetingIds), eq(actionItems.status, "todo")))
    : [];

  const completedTasks = userTasks.filter((t) => t.status === "done").length;
  const totalSeconds = rows.reduce((sum, m) => sum + (m.durationSeconds ?? 0), 0);
  const hoursRecorded = (totalSeconds / 3600).toFixed(1);

  return (
    <div className="flex flex-col gap-8">
      <div className="animate-fade-in-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Every meeting you&apos;ve uploaded or recorded, with status and AI insights.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/record">
              <Mic className="mr-2 h-4 w-4" />
              Record
            </Link>
          </Button>
          <Button asChild>
            <Link href="/upload">
              <UploadCloud className="mr-2 h-4 w-4" />
              Upload
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Meetings"
          value={rows.length}
          icon={Video}
          style={{ animationDelay: "0ms" }}
        />
        <StatCard
          label="Action Items"
          value={openActionItems.length}
          icon={ListChecks}
          style={{ animationDelay: "50ms" }}
        />
        <StatCard
          label="Completed Tasks"
          value={completedTasks}
          icon={CheckCircle2}
          style={{ animationDelay: "100ms" }}
        />
        <StatCard
          label="Hours Recorded"
          value={hoursRecorded}
          icon={Clock}
          style={{ animationDelay: "150ms" }}
        />
      </div>

      <TodaysMeetings
        meetings={todaysScheduled.map((m) => ({
          id: m.id,
          title: m.title,
          platform: m.platform,
          scheduledAt: m.scheduledAt.toISOString(),
        }))}
      />

      <MeetingsList
        initialMeetings={rows.map((m) => ({
          id: m.id,
          title: m.title,
          platform: m.platform,
          status: m.status,
          durationSeconds: m.durationSeconds,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
