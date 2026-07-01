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
import type { IssueTrackerProvider } from "@/db/schema";
import type { IssueTrackerIntegrationView, ProjectView } from "@/types/issue-tracker";

export function TrackerCard({
  provider,
  icon: Icon,
  title,
  description,
  projectLabel,
  projectsRoute,
}: {
  provider: IssueTrackerProvider;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  projectLabel: string;
  projectsRoute: string;
}) {
  const { activeWorkspaceId } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [info, setInfo] = useState<IssueTrackerIntegrationView | null>(null);
  const [projects, setProjects] = useState<ProjectView[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function loadStatus(wsId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/${provider}/settings?workspaceId=${wsId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setInfo(data[provider]);
    } catch {
      toast.error(`Failed to load ${title} status`);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeWorkspaceId) loadStatus(activeWorkspaceId); }, [activeWorkspaceId]);

  useEffect(() => {
    const status = searchParams.get(provider);
    if (!status) return;
    if (status === "connected") toast.success(`${title} connected`);
    if (status === "error") toast.error(searchParams.get("message") ?? `Failed to connect ${title}`);
    router.replace("/settings/integrations");
  }, [searchParams, router, provider, title]);

  useEffect(() => {
    if (!activeWorkspaceId || !info?.connected || projects !== null) return;
    fetch(`${projectsRoute}?workspaceId=${activeWorkspaceId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setProjects(data.projects ?? data.teams ?? []))
      .catch(() => setProjects([]));
  }, [activeWorkspaceId, info?.connected, projects, projectsRoute]);

  async function handleProjectChange(projectId: string) {
    if (!activeWorkspaceId) return;
    const proj = projects?.find((p) => p.id === projectId);
    setSaving(true);
    try {
      const res = await fetch(`/api/integrations/${provider}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          defaultProjectId: projectId,
          defaultProjectName: proj?.name ?? null,
        }),
      });
      if (!res.ok) throw new Error();
      await loadStatus(activeWorkspaceId);
    } catch {
      toast.error(`Failed to update ${title} settings`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!activeWorkspaceId) return;
    setDisconnecting(true);
    try {
      const res = await fetch(
        `/api/integrations/${provider}/disconnect?workspaceId=${activeWorkspaceId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      setInfo({ provider, connected: false, site_name: null, default_project_id: null, default_project_name: null });
      setProjects(null);
      toast.success(`${title} disconnected`);
    } catch {
      toast.error(`Failed to disconnect ${title}`);
    } finally {
      setDisconnecting(false);
      setDisconnectOpen(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : !info?.connected ? (
          <div className="flex items-center justify-between gap-4">
            <Badge variant="secondary">Not connected</Badge>
            <Button asChild disabled={!activeWorkspaceId}>
              <a href={activeWorkspaceId ? `/api/integrations/${provider}/connect?workspaceId=${activeWorkspaceId}` : "#"}>
                Connect {title}
              </a>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Badge>Connected</Badge>
                {info.site_name && <span className="text-sm text-muted-foreground">{info.site_name}</span>}
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDisconnectOpen(true)}>
                Disconnect
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{projectLabel}</Label>
              <Select
                value={info.default_project_id ?? undefined}
                onValueChange={handleProjectChange}
                disabled={saving || projects === null}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={projects === null ? "Loading..." : `Select a ${projectLabel.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.key ? `[${p.key}] ` : ""}{p.name}
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
            <DialogTitle>Disconnect {title}</DialogTitle>
            <DialogDescription>
              Action items will no longer be linked to {title} for this workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>Cancel</Button>
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
