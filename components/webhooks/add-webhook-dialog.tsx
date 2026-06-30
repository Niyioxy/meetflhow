"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { webhookEventEnum, type WebhookEvent } from "@/db/schema";
import { WEBHOOK_EVENT_LABELS, type WebhookView } from "@/types/webhooks";

export function AddWebhookDialog({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  onCreated: (webhook: WebhookView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setUrl("");
    setEvents([]);
  }

  function toggleEvent(event: WebhookEvent, checked: boolean) {
    setEvents((prev) => (checked ? [...prev, event] : prev.filter((e) => e !== event)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim() || events.length === 0) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, name, url, events }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to create webhook");
      onCreated(data.webhook);
      toast.success("Webhook created");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add webhook</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook-name">Name</Label>
            <Input
              id="webhook-name"
              placeholder="Zapier"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="webhook-url">URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://hooks.zapier.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Must be an https:// URL.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Events</Label>
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              {webhookEventEnum.map((event) => (
                <div key={event} className="flex items-center gap-2">
                  <Checkbox
                    id={`event-${event}`}
                    checked={events.includes(event)}
                    onCheckedChange={(checked) => toggleEvent(event, checked === true)}
                  />
                  <Label htmlFor={`event-${event}`} className="text-sm font-normal">
                    {WEBHOOK_EVENT_LABELS[event]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || !name.trim() || !url.trim() || events.length === 0}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
