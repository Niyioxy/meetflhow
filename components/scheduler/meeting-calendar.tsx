"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enUS }),
  getDay,
  locales: { "en-US": enUS },
});

export interface CalendarMeeting {
  id: string;
  title: string;
  platform: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink: string | null;
  notes: string | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarMeeting;
}

export function MeetingCalendar({ meetings }: { meetings: CalendarMeeting[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<CalendarMeeting | null>(null);
  const [deleting, setDeleting] = useState(false);

  const events: CalendarEvent[] = useMemo(
    () =>
      meetings.map((m) => {
        const start = new Date(m.scheduledAt);
        const end = new Date(start.getTime() + m.durationMinutes * 60_000);
        return { id: m.id, title: m.title, start, end, resource: m };
      }),
    [meetings]
  );

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/scheduled-meetings/${selected.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete meeting");
      toast.success("Meeting deleted");
      setSelected(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="h-[70vh] rounded-[var(--radius-lg)] border border-border bg-[var(--bg-surface)] p-4">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          defaultView={Views.MONTH}
          selectable
          onSelectEvent={(event) => setSelected(event.resource)}
          onSelectSlot={(slot) => router.push(`/schedule-meeting?date=${slot.start.toISOString()}`)}
          style={{ height: "100%" }}
        />
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  {format(new Date(selected.scheduledAt), "MMM d, yyyy · h:mm a")} ·{" "}
                  {selected.durationMinutes} min
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 text-sm">
                <PlatformBadge platform={selected.platform} className="w-fit" />
                {selected.meetLink && (
                  <a
                    href={selected.meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    Join meeting
                  </a>
                )}
                {selected.notes && <p className="text-muted-foreground">{selected.notes}</p>}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="text-destructive"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  Delete
                </Button>
                <Button onClick={() => router.push(`/schedule-meeting/${selected.id}`)}>Edit</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
