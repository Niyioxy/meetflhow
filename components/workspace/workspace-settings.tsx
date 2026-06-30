"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleBadge } from "@/components/workspace/role-badge";
import { workspaceRoleEnum } from "@/db/schema";
import { roleAtLeast } from "@/lib/workspace-roles";
import type { WorkspaceDetail } from "@/types/workspace";

const INVITABLE_ROLES = workspaceRoleEnum.filter((r) => r !== "owner");

export function WorkspaceSettings() {
  const { activeWorkspaceId, workspaces, refresh } = useWorkspace();
  const [detail, setDetail] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof INVITABLE_ROLES)[number]>("member");
  const [inviting, setInviting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function loadDetail() {
    if (!activeWorkspaceId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetail(data.workspace);
      setName(data.workspace.name);
    } catch {
      toast.error("Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  async function handleRename() {
    if (!detail || !name.trim() || name === detail.name) return;
    setSavingName(true);
    try {
      const res = await fetch(`/api/workspaces/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      toast.success("Workspace renamed");
      await Promise.all([loadDetail(), refresh()]);
    } catch {
      toast.error("Failed to rename workspace");
    } finally {
      setSavingName(false);
    }
  }

  async function handleInvite() {
    if (!detail || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/workspaces/${detail.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to send invite");
      }
      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail("");
      await loadDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, role: string) {
    if (!detail) return;
    try {
      const res = await fetch(`/api/workspaces/${detail.id}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error();
      await loadDetail();
    } catch {
      toast.error("Failed to update role");
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!detail) return;
    try {
      const res = await fetch(`/api/workspaces/${detail.id}/members/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Member removed");
      await loadDetail();
    } catch {
      toast.error("Failed to remove member");
    }
  }

  async function handleCancelInvite(inviteId: string) {
    if (!detail) return;
    try {
      const res = await fetch(`/api/workspaces/${detail.id}/invites/${inviteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await loadDetail();
    } catch {
      toast.error("Failed to cancel invite");
    }
  }

  async function handleDelete() {
    if (!detail) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${detail.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Workspace deleted");
      setDeleteOpen(false);
      await refresh();
    } catch {
      toast.error("Failed to delete workspace");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading workspace...
      </div>
    );
  }

  if (!detail) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {workspaces.length === 0
            ? "Create a workspace from the sidebar to get started."
            : "Select a workspace from the sidebar."}
        </CardContent>
      </Card>
    );
  }

  const canManage = roleAtLeast(detail.role, "admin");
  const isOwner = detail.role === "owner";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace name</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
          {canManage && (
            <Button onClick={handleRename} disabled={savingName || name === detail.name || !name.trim()}>
              {savingName && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Invite a member</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role} className="capitalize">
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Invite
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>{detail.members.length} member{detail.members.length === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {detail.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.image ?? undefined} alt={m.name ?? ""} />
                  <AvatarFallback>{(m.name ?? m.email).slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{m.name ?? m.email}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage && m.role !== "owner" ? (
                  <Select value={m.role} onValueChange={(v) => handleRoleChange(m.user_id, v)}>
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role} className="capitalize">
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <RoleBadge role={m.role} />
                )}
                {canManage && m.role !== "owner" && (
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.user_id)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {detail.pending_invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {detail.pending_invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{invite.role}</p>
                </div>
                {canManage && (
                  <Button variant="ghost" size="sm" onClick={() => handleCancelInvite(invite.id)}>
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card className="border-[rgba(239,68,68,0.3)]">
          <CardHeader>
            <CardTitle className="text-[#F87171]">Danger zone</CardTitle>
            <CardDescription>Deleting a workspace removes all members and unlinks its meetings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete workspace
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {detail.name}?</DialogTitle>
            <DialogDescription>
              This permanently removes the workspace and all members. Meetings shared with it become
              private to their owners. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
