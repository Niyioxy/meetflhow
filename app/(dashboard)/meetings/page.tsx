import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { MeetingsList } from "@/components/dashboard/meetings-list";
import { Mic, UploadCloud } from "lucide-react";

export default async function MeetingsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const memberWorkspaceIds = (
    await db.query.workspaceMembers.findMany({
      where: (m, { eq }) => eq(m.userId, userId),
      columns: { workspaceId: true },
    })
  ).map((m) => m.workspaceId);

  const rows = await db
    .select()
    .from(meetings)
    .where(
      memberWorkspaceIds.length > 0
        ? or(
            eq(meetings.userId, userId),
            and(eq(meetings.sharedWithWorkspace, true), inArray(meetings.workspaceId, memberWorkspaceIds))
          )
        : eq(meetings.userId, userId)
    )
    .orderBy(desc(meetings.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">
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
