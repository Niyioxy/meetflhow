"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconBrandNotion } from "@tabler/icons-react";
import type { NotionDatabaseView, NotionIntegrationView } from "@/types/notion";

export function NotionCard() {
  const { activeWorkspaceId } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [notion, setNotion] = useState<NotionIntegrationView | null>(null);
  const [databases, setDatabases] = useState<NotionDatabaseView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function loadStatus(workspaceId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/notion/settings?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotion(data.notion);
    } catch {
      toast.error("Failed to load Notion status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!activeWorkspaceId) return;
    loadStatus(activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    const status = searchParams.get("notion");
    if (!status) return;
    if (status === "connected") toast.success("Notion connected");
    if (status === "error") toast.error(searchParams.get("message") ?? "Failed to connect Notion");
    router.replace("/settings/integrations");
  }, [searchParams, router]);

  useEffect(() => {
    if (!activeWorkspaceId || !notion?.connected || databases !== null) return;
    fetch(`/api/integrations/notion/databases?workspaceId=${activeWorkspaceId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setDatabases(data.databases))
      .catch(() => setDatabases([]));
  }, [activeWorkspaceId, notion?.connected, databases]);

  async function handleDatabaseChange(databaseId: string) {
    if (!activeWorkspaceId) return;
    const database = databases?.find((d) => d.id === databaseId);
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/notion/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          databaseId,
          databaseName: database?.name ?? null,
        }),
      });
      if (!res.ok) throw new Error();
      await loadStatus(activeWorkspaceId);
    } catch {
      toast.error("Failed to update Notion settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!activeWorkspaceId) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/integrations/notion/disconnect?workspaceId=${activeWorkspaceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setNotion({ connected: false, workspace_name: null, workspace_icon: null, database_id: null, database_name: null });
      setDatabases(null);
      toast.success("Notion disconnected");
    } catch {
      toast.error("Failed to disconnect Notion");
    } finally {
      setDisconnecting(false);
      setDisconnectOpen(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <IconBrandNotion className="h-6 w-6" />
          <CardTitle>Notion</CardTitle>
        </div>
        <CardDescription>Push meeting notes and action items into a Notion database.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : !notion?.connected ? (
          <div className="flex items-center justify-between gap-4">
            <Badge variant="secondary">Not connected</Badge>
            <Button asChild disabled={!activeWorkspaceId}>
              <a href={activeWorkspaceId ? `/api/integrations/notion/connect?workspaceId=${activeWorkspaceId}` : "#"}>
                Connect Notion
              </a>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Badge>Connected</Badge>
                <span className="text-sm text-muted-foreground">{notion.workspace_name}</span>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDisconnectOpen(true)}>
                Disconnect
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Database</Label>
              <Select
                value={notion.database_id ?? undefined}
                onValueChange={handleDatabaseChange}
                disabled={saving || databases === null}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={databases === null ? "Loading databases..." : "Select a database"} />
                </SelectTrigger>
                <SelectContent>
                  {(databases ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Notion</DialogTitle>
            <DialogDescription>
              MeetFlhow will stop pushing meeting notes to Notion for this workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={disconnecting} onClick={handleDisconnect}>
              {disconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
