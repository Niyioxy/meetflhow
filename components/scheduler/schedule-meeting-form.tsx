"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2 } from "lucide-react";
import { scheduledMeetingPlatformEnum } from "@/db/schema";
import { AgendaSuggestion } from "@/components/scheduler/agenda-suggestion";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

export interface ScheduleMeetingFormData {
  id: string;
  title: string;
  platform: string;
  scheduledAt: string;
  durationMinutes: number;
  attendees: string[];
  notes: string | null;
}

export function ScheduleMeetingForm({
  initialData,
  initialDate,
}: {
  initialData?: ScheduleMeetingFormData;
  initialDate?: string;
}) {
  const router = useRouter();
  const isEditing = Boolean(initialData);

  const initial = initialData ? new Date(initialData.scheduledAt) : initialDate ? new Date(initialDate) : null;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [platform, setPlatform] = useState(initialData?.platform ?? "Google Meet");
  const [date, setDate] = useState(initial ? format(initial, "yyyy-MM-dd") : "");
  const [time, setTime] = useState(initial ? format(initial, "HH:mm") : "");
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes ?? 30);
  const [attendees, setAttendees] = useState(initialData?.attendees.join(", ") ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !time) {
      toast.error("Title, date and time are required");
      return;
    }

    const scheduledAt = new Date(`${date}T${time}`);
    const attendeeList = attendees
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const res = await fetch(
        isEditing ? `/api/scheduled-meetings/${initialData!.id}` : "/api/scheduled-meetings",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            platform,
            scheduledAt: scheduledAt.toISOString(),
            durationMinutes,
            attendees: attendeeList,
            notes: notes || null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save meeting");
      }

      toast.success(isEditing ? "Meeting updated" : "Meeting scheduled");
      router.push("/calendar");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!initialData) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/scheduled-meetings/${initialData.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete meeting");
      toast.success("Meeting deleted");
      router.push("/calendar");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit meeting" : "Schedule a meeting"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="meeting-title">Title</Label>
            <Input
              id="meeting-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly sync"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="meeting-date">Date</Label>
              <Input
                id="meeting-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="meeting-time">Time</Label>
              <Input
                id="meeting-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Duration</Label>
              <Select
                value={String(durationMinutes)}
                onValueChange={(v) => setDurationMinutes(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scheduledMeetingPlatformEnum.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="meeting-attendees">Attendees</Label>
            <Input
              id="meeting-attendees"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="alex@example.com, sam@example.com"
            />
            <p className="text-xs text-muted-foreground">Comma-separated email addresses</p>
          </div>

          <AgendaSuggestion
            title={title}
            attendees={attendees
              .split(",")
              .map((email) => email.trim())
              .filter(Boolean)}
            scheduledAt={date && time ? new Date(`${date}T${time}`).toISOString() : ""}
            onAddToNotes={(text) =>
              setNotes((prev) => (prev ? `${prev}\n\n${text}` : text))
            }
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="meeting-notes">Notes</Label>
            <Textarea
              id="meeting-notes"
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Agenda, links, context..."
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            {isEditing ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
                className="text-destructive"
              >
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete
              </Button>
            ) : (
              <div />
            )}
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save changes" : "Schedule meeting"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
