"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { FileAudio, ChevronRight, Trash2, Loader2 } from "lucide-react";
import type { MeetingStatus } from "@/db/schema";

export interface MeetingListItem {
  id: string;
  title: string;
  platform: string;
  status: MeetingStatus;
  durationSeconds: number | null;
  createdAt: string;
}

const IN_PROGRESS: MeetingStatus[] = ["uploading", "transcribing", "analyzing"];

export function MeetingsList({ initialMeetings }: { initialMeetings: MeetingListItem[] }) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [deleteTarget, setDeleteTarget] = useState<MeetingListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/meetings/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMeetings((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      toast.success("Meeting deleted");
    } catch {
      toast.error("Failed to delete meeting");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  useEffect(() => {
    const hasInProgress = meetings.some((m) => IN_PROGRESS.includes(m.status));
    if (!hasInProgress) return;

    const interval = setInterval(async () => {
      const res = await fetch("/api/meetings");
      if (!res.ok) return;
      const data = await res.json();
      setMeetings(data.meetings);
    }, 4000);

    return () => clearInterval(interval);
  }, [meetings]);

  if (meetings.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <FileAudio className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">No meetings yet</p>
          <p className="text-sm text-muted-foreground">
            Upload a recording or paste a transcript to get started.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="animate-fade-in-up flex flex-col gap-3">
      <h2 className="text-sm font-medium uppercase tracking-widest text-[var(--text-muted)]">
        Recent meetings
      </h2>
      <Card className="overflow-hidden p-0 hover:translate-y-0 hover:shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Title</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.map((meeting) => (
              <TableRow key={meeting.id}>
                <TableCell className="font-medium text-foreground">{meeting.title}</TableCell>
                <TableCell>
                  <PlatformBadge platform={meeting.platform} />
                </TableCell>
                <TableCell className="text-[var(--text-secondary)]">
                  {format(new Date(meeting.createdAt), "MMM d, yyyy · h:mm a")}
                  {meeting.durationSeconds ? ` · ${Math.round(meeting.durationSeconds / 60)} min` : ""}
                </TableCell>
                <TableCell>
                  <StatusBadge status={meeting.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/meetings/${meeting.id}`}>
                        View
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete meeting"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(meeting)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete meeting</DialogTitle>
            <DialogDescription>
              This permanently deletes {deleteTarget ? `"${deleteTarget.title}"` : "this meeting"} —
              its transcript, summary, action items, and any comments or shares. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
