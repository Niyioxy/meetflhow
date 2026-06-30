"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityBadge } from "@/components/meeting/priority-badge";
import { actionItemsToCsv } from "@/lib/csv";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { initialsFromName, colorFromName } from "@/lib/avatar";
import { CheckCircle2, Circle, Copy, Download, AtSign } from "lucide-react";
import type { ActionItemStatus, Priority } from "@/db/schema";
import type { MentionableMember } from "@/types/mentions";
import { cn } from "@/lib/utils";

export interface ActionItem {
  id: string;
  task: string;
  owner: string | null;
  assigneeUserId?: string | null;
  deadline: string | null;
  priority: Priority;
  status: ActionItemStatus;
}

function AssigneeCell({
  item,
  onAssign,
}: {
  item: ActionItem;
  onAssign: (member: MentionableMember) => void;
}) {
  const { activeWorkspaceId } = useWorkspace();
  const [members, setMembers] = useState<MentionableMember[]>([]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetch(`/api/workspaces/${activeWorkspaceId}/members`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const list = (data.members ?? []) as { user_id: string; name: string | null; email: string; image: string | null }[];
        setMembers(list.map((m) => ({ id: m.user_id, name: m.name, email: m.email, image: m.image })));
      })
      .catch(() => setMembers([]));
  }, [activeWorkspaceId]);

  if (!activeWorkspaceId || members.length === 0) {
    return <>{item.owner ?? "—"}</>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-sm hover:bg-muted">
          {item.owner ? (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              style={{ backgroundColor: colorFromName(item.owner) }}
            >
              {initialsFromName(item.owner)}
            </span>
          ) : (
            <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {item.owner ?? "Assign"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {members.map((m) => (
          <DropdownMenuItem key={m.id} onClick={() => onAssign(m)} className="gap-2">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              style={{ backgroundColor: colorFromName(m.name ?? m.email) }}
            >
              {initialsFromName(m.name ?? m.email)}
            </span>
            {m.name ?? m.email}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ActionItemsCard({
  meetingTitle,
  initialItems,
}: {
  meetingTitle: string;
  initialItems: ActionItem[];
}) {
  const [items, setItems] = useState(initialItems);

  async function toggleStatus(item: ActionItem) {
    const nextStatus: ActionItemStatus = item.status === "todo" ? "done" : "todo";
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i))
    );

    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i))
      );
      toast.error("Failed to update action item");
    }
  }

  function handleDownloadCsv() {
    const csv = actionItemsToCsv(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meetingTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-action-items.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    const csv = actionItemsToCsv(items);
    await navigator.clipboard.writeText(csv);
    toast.success("Action items copied to clipboard");
  }

  async function handleAssign(item: ActionItem, member: MentionableMember) {
    const previous = item;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, owner: member.name ?? member.email, assigneeUserId: member.id } : i
      )
    );

    try {
      const res = await fetch(`/api/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeUserId: member.id }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Assigned to ${member.name ?? member.email}`);
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? previous : i)));
      toast.error("Failed to assign action item");
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Action items</CardTitle>
          <CardDescription>No action items were extracted from this meeting.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Action items</CardTitle>
          <CardDescription>{items.length} tracked tasks from this meeting</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadCsv}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Priority</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <button onClick={() => toggleStatus(item)} aria-label="Toggle status">
                    {item.status === "done" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </TableCell>
                <TableCell
                  className={cn(item.status === "done" && "text-muted-foreground line-through")}
                >
                  {item.task}
                </TableCell>
                <TableCell>
                  <AssigneeCell item={item} onAssign={(member) => handleAssign(item, member)} />
                </TableCell>
                <TableCell>{item.deadline ?? "—"}</TableCell>
                <TableCell>
                  <PriorityBadge priority={item.priority} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
