"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddWebhookDialog } from "@/components/webhooks/add-webhook-dialog";
import { WebhookRow } from "@/components/webhooks/webhook-row";
import type { WebhookView } from "@/types/webhooks";

export function WebhookManager() {
  const { activeWorkspaceId, loading: workspaceLoading } = useWorkspace();
  const [webhooks, setWebhooks] = useState<WebhookView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setWebhooks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/webhooks?workspaceId=${activeWorkspaceId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setWebhooks(data.webhooks ?? []))
      .catch(() => toast.error("Failed to load webhooks"))
      .finally(() => setLoading(false));
  }, [activeWorkspaceId]);

  if (workspaceLoading || loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!activeWorkspaceId) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Select or create a workspace to manage webhooks.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <AddWebhookDialog
          workspaceId={activeWorkspaceId}
          onCreated={(webhook) => setWebhooks((prev) => [webhook, ...prev])}
        />
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No webhooks yet. Add one to start sending events to Zapier or any HTTPS endpoint.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last triggered</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((webhook) => (
                <WebhookRow
                  key={webhook.id}
                  webhook={webhook}
                  onChanged={(updated) =>
                    setWebhooks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
                  }
                  onDeleted={(id) => setWebhooks((prev) => prev.filter((w) => w.id !== id))}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
