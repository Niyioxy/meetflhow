import { ScheduleMeetingForm } from "@/components/scheduler/schedule-meeting-form";

export default function ScheduleMeetingPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule a meeting</h1>
        <p className="text-sm text-muted-foreground">
          Set up a meeting and we&apos;ll remind you 30 minutes before it starts.
        </p>
      </div>
      <ScheduleMeetingForm initialDate={searchParams.date} />
    </div>
  );
}
