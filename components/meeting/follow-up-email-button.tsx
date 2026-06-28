"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function FollowUpEmailButton({ meetingId }: { meetingId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/follow-up-email`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSubject(data.subject);
      setBody(data.body);
      setReplyTo(data.replyTo ?? null);
      setRecipients((data.recipients ?? []).join(", "));
    } catch {
      toast.error("Failed to draft follow-up email");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(when: "now" | "tomorrow_9am") {
    const recipientList = recipients
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    if (recipientList.length === 0) {
      toast.error("Add at least one recipient");
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/follow-up-email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: recipientList,
          replyTo,
          subject,
          body,
          when,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to send email");
      }

      toast.success(
        when === "now"
          ? `Follow-up sent to ${recipientList.length} attendee${recipientList.length === 1 ? "" : "s"} ✓`
          : "Follow-up scheduled for tomorrow 9am ✓"
      );
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        📧 Send Follow-up Email
      </Button>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Follow-up email</DialogTitle>
          <DialogDescription>Review and edit before sending.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Drafting email...
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="follow-up-recipients">Recipients</Label>
              <Input
                id="follow-up-recipients"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="alex@example.com, sam@example.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="follow-up-subject">Subject</Label>
              <Input
                id="follow-up-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="follow-up-body">Body (HTML)</Label>
              <Textarea
                id="follow-up-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-48"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            disabled={loading || sending}
            onClick={() => handleSend("tomorrow_9am")}
          >
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Schedule for tomorrow 9am
          </Button>
          <Button disabled={loading || sending} onClick={() => handleSend("now")}>
            {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
