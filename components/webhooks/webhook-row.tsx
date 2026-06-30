"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronRight, Loader2, Send, Trash2 } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WEBHOOK_EVENT_LABELS, type WebhookLogView, type WebhookView } from "@/types/webhooks";

function truncateUrl(url: string, max = 42) {
  return url.length > max ? `${url.slice(0, max)}…` : url;
}

export function WebhookRow({
  webhook,
  onChanged,
  onDeleted,
}: {
  webhook: WebhookView;
  onChanged: (webhook: WebhookView) => void;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<WebhookLogView[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    if (next && logs === null) {
      setLoadingLogs(true);
      try {
        const res = await fetch(`/api/webhooks/${webhook.id}/logs`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setLogs(data.logs);
      } catch {
        toast.error("Failed to load logs");
      } finally {
        setLoadingLogs(false);
      }
    }
  }

  async function handleToggleActive(checked: boolean) {
    setToggling(true);
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: checked }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onChanged(data.webhook);
    } catch {
      toast.error("Failed to update webhook");
    } finally {
      setToggling(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}/test`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Test failed");
      toast[data.success ? "success" : "error"](
        data.success ? "Test payload delivered" : "Test payload failed to deliver"
      );
      setLogs(null);
      if (expanded) toggleExpanded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/webhooks/${webhook.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(webhook.id);
      toast.success("Webhook deleted");
    } catch {
      toast.error("Failed to delete webhook");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  return (
    <>
      <TableRow className="cursor-pointer" onClick={toggleExpanded} aria-expanded={expanded}>
        <TableCell className="w-6">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-medium">{webhook.name}</TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">
          {truncateUrl(webhook.url)}
        </TableCell>
        <TableCell>{webhook.events.length}</TableCell>
        <TableCell>
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              webhook.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"
            }`}
            title={webhook.is_active ? "Active" : "Inactive"}
          />
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {webhook.last_triggered_at
            ? formatDistanceToNow(new Date(webhook.last_triggered_at), { addSuffix: true })
            : "Never"}
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <Switch checked={webhook.is_active} disabled={toggling} onCheckedChange={handleToggleActive} />
            <Button variant="outline" size="icon" title="Send test" disabled={testing} onClick={handleTest}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              title="Delete"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/20">
            {loadingLogs ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading logs...
              </div>
            ) : !logs || logs.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No deliveries yet.</p>
            ) : (
              <div className="flex flex-col gap-1 py-2 text-sm">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-4 py-1">
                    <span className="text-muted-foreground">{WEBHOOK_EVENT_LABELS[log.event]}</span>
                    <span className={log.success ? "text-emerald-500" : "text-destructive"}>
                      {log.success ? "✓" : "✗"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                    <span className="text-xs text-muted-foreground">{log.response_status ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete webhook</DialogTitle>
            <DialogDescription>
              This will stop all deliveries to {webhook.name}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
