"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ChevronsUpDown, Settings } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function WorkspaceAvatar({ name, color, size = 24 }: { name: string; color: string | null; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color ?? "#2563EB", width: size, height: size }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { workspaces, activeWorkspace, setActiveWorkspaceId, refresh } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      await refresh();
      setActiveWorkspaceId(data.workspace.id);
      toast.success(`${data.workspace.name} created`);
      setCreateOpen(false);
      setName("");
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  if (workspaces.length === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          New Workspace
        </button>
        <CreateWorkspaceDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          name={name}
          setName={setName}
          creating={creating}
          onCreate={handleCreate}
        />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
        >
          {activeWorkspace && (
            <WorkspaceAvatar name={activeWorkspace.name} color={activeWorkspace.avatar_color} />
          )}
          {!compact && (
            <span className="min-w-0 flex-1 truncate">{activeWorkspace?.name ?? "Select workspace"}</span>
          )}
          {!compact && <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onClick={() => setActiveWorkspaceId(w.id)} className="gap-2">
            <WorkspaceAvatar name={w.name} color={w.avatar_color} size={20} />
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            {w.id === activeWorkspace?.id && <span className="text-xs text-[var(--blue-glow)]">Active</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings/workspace")} className="gap-2">
          <Settings className="h-4 w-4" />
          Manage Workspace
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        name={name}
        setName={setName}
        creating={creating}
        onCreate={handleCreate}
      />
    </DropdownMenu>
  );
}

function CreateWorkspaceDialog({
  open,
  onOpenChange,
  name,
  setName,
  creating,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  setName: (name: string) => void;
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workspace name"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
        />
        <DialogFooter>
          <Button onClick={onCreate} disabled={creating || !name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
