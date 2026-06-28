import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { ScheduleMeetingForm } from "@/components/scheduler/schedule-meeting-form";

export default async function EditScheduleMeetingPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const meeting = await db.query.scheduledMeetings.findFirst({
    where: (m, { and, eq }) => and(eq(m.id, params.id), eq(m.userId, session!.user.id)),
  });

  if (!meeting) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit meeting</h1>
      </div>
      <ScheduleMeetingForm
        initialData={{
          id: meeting.id,
          title: meeting.title,
          platform: meeting.platform,
          scheduledAt: meeting.scheduledAt.toISOString(),
          durationMinutes: meeting.durationMinutes,
          attendees: meeting.attendees,
          notes: meeting.notes,
        }}
      />
    </div>
  );
}
