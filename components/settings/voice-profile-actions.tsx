"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EnrolmentFlow } from "@/components/voice-profile/enrolment-flow";

export function VoiceProfileActions({ enrolled }: { enrolled: boolean }) {
  const router = useRouter();
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleDone() {
    setEnrolOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/voice-profile", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete voice profile");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Dialog open={enrolOpen} onOpenChange={setEnrolOpen}>
        <Button
          variant={enrolled ? "outline" : "default"}
          onClick={() => setEnrolOpen(true)}
        >
          {enrolled ? "Re-record voice profile" : "Enrol now"}
        </Button>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Teach MeetFlhow your voice</DialogTitle>
            <DialogDescription>
              Read the passage aloud so MeetFlhow can recognise you in meetings.
            </DialogDescription>
          </DialogHeader>
          <EnrolmentFlow mode={enrolled ? "re-enrol" : "enrol"} onDone={handleDone} />
        </DialogContent>
      </Dialog>

      {enrolled && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete voice profile
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete voice profile?</DialogTitle>
              <DialogDescription>
                MeetFlhow will no longer be able to identify you by voice in meetings. You can re-enrol
                anytime.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
