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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconBrandSlack } from "@tabler/icons-react";
import type { SlackChannelView, SlackIntegrationView } from "@/types/slack";

export function SlackCard() {
  const { activeWorkspaceId } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [slack, setSlack] = useState<SlackIntegrationView | null>(null);
  const [channels, setChannels] = useState<SlackChannelView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function loadStatus(workspaceId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/slack/settings?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSlack(data.slack);
    } catch {
      toast.error("Failed to load Slack status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!activeWorkspaceId) return;
    loadStatus(activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    const status = searchParams.get("slack");
    if (!status) return;
    if (status === "connected") toast.success("Slack connected");
    if (status === "error") toast.error(searchParams.get("message") ?? "Failed to connect Slack");
    router.replace("/settings/integrations");
  }, [searchParams, router]);

  useEffect(() => {
    if (!activeWorkspaceId || !slack?.connected || channels !== null) return;
    fetch(`/api/integrations/slack/channels?workspaceId=${activeWorkspaceId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setChannels(data.channels))
      .catch(() => setChannels([]));
  }, [activeWorkspaceId, slack?.connected, channels]);

  async function saveSettings(patch: Record<string, unknown>) {
    if (!activeWorkspaceId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/slack/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWorkspaceId, ...patch }),
      });
      if (!res.ok) throw new Error();
      await loadStatus(activeWorkspaceId);
    } catch {
      toast.error("Failed to update Slack settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleChannelChange(channelId: string) {
    const channel = channels?.find((c) => c.id === channelId);
    await saveSettings({ channelId, channelName: channel?.name ?? null });
  }

  async function handleDisconnect() {
    if (!activeWorkspaceId) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/integrations/slack/disconnect?workspaceId=${activeWorkspaceId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setSlack({ connected: false, team_name: null, default_channel_id: null, default_channel_name: null, auto_post_summary: true, auto_post_action_items: true });
      setChannels(null);
      toast.success("Slack disconnected");
    } catch {
      toast.error("Failed to disconnect Slack");
    } finally {
      setDisconnecting(false);
      setDisconnectOpen(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <IconBrandSlack className="h-6 w-6" />
          <CardTitle>Slack</CardTitle>
        </div>
        <CardDescription>Auto-post meeting summaries and action items to a Slack channel.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : !slack?.connected ? (
          <div className="flex items-center justify-between gap-4">
            <Badge variant="secondary">Not connected</Badge>
            <Button asChild disabled={!activeWorkspaceId}>
              <a href={activeWorkspaceId ? `/api/integrations/slack/connect?workspaceId=${activeWorkspaceId}` : "#"}>
                Connect Slack
              </a>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Badge>Connected</Badge>
                <span className="text-sm text-muted-foreground">{slack.team_name}</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDisconnectOpen(true)}
              >
                Disconnect
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Channel</Label>
              <Select
                value={slack.default_channel_id ?? undefined}
                onValueChange={handleChannelChange}
                disabled={saving || channels === null}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={channels === null ? "Loading channels..." : "Select a channel"} />
                </SelectTrigger>
                <SelectContent>
                  {(channels ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      #{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="slack-auto-summary" className="text-sm font-normal">
                Auto-post summaries
              </Label>
              <Switch
                id="slack-auto-summary"
                checked={slack.auto_post_summary}
                disabled={saving}
                onCheckedChange={(checked) => saveSettings({ autoPostSummary: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="slack-auto-items" className="text-sm font-normal">
                Auto-post action items
              </Label>
              <Switch
                id="slack-auto-items"
                checked={slack.auto_post_action_items}
                disabled={saving}
                onCheckedChange={(checked) => saveSettings({ autoPostActionItems: checked })}
              />
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Slack</DialogTitle>
            <DialogDescription>
              MeetFlhow will stop posting meeting summaries to Slack for this workspace.
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
