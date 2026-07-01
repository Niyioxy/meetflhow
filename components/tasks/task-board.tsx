"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { cn } from "@/lib/utils";
import { ExternalLink, Loader2, Ticket } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { Priority, TaskStatus, IssueTrackerProvider } from "@/db/schema";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  assignedTo: string | null;
  meetingId: string | null;
  externalTicketId?: string | null;
  externalTicketUrl?: string | null;
  externalProvider?: IssueTrackerProvider | null;
}

export interface MeetingOption {
  id: string;
  title: string;
}

const COLUMNS: { id: TaskStatus; label: string; borderColor: string }[] = [
  { id: "backlog", label: "Backlog", borderColor: "var(--blue-primary)" },
  { id: "in_progress", label: "In Progress", borderColor: "var(--amber)" },
  { id: "in_review", label: "In Review", borderColor: "#A855F7" },
  { id: "done", label: "Done", borderColor: "var(--green)" },
];

export function TaskBoard({
  initialTasks,
  meetings,
}: {
  initialTasks: TaskRow[];
  meetings: MeetingOption[];
}) {
  const { activeWorkspaceId } = useWorkspace();
  const [tasks, setTasks] = useState(initialTasks);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [meetingFilter, setMeetingFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [connectedProviders, setConnectedProviders] = useState<IssueTrackerProvider[]>([]);
  const [bulkCreating, setBulkCreating] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetch(`/api/integrations/issue-trackers?workspaceId=${activeWorkspaceId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setConnectedProviders((data.connected ?? []).map((c: { provider: IssueTrackerProvider }) => c.provider)))
      .catch(() => {});
  }, [activeWorkspaceId]);

  const meetingTitleById = useMemo(
    () => new Map(meetings.map((m) => [m.id, m.title])),
    [meetings]
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (priorityFilter !== "all") params.set("priority", priorityFilter);
    if (meetingFilter !== "all") params.set("meetingId", meetingFilter);
    if (dueDateFilter) params.set("dueDate", dueDateFilter);

    fetch(`/api/tasks?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setTasks(data.tasks));
  }, [priorityFilter, meetingFilter, dueDateFilter]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const newStatus = over.id as TaskStatus;
    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t)));
      toast.error("Failed to move task");
    }
  }

  const hasFilters = priorityFilter !== "all" || meetingFilter !== "all" || Boolean(dueDateFilter);

  async function handleBulkCreateTickets(provider: IssueTrackerProvider) {
    const ids = Array.from(selectedIds);
    setBulkCreating(true);
    let succeeded = 0;
    await Promise.all(
      ids.map(async (taskId) => {
        try {
          const res = await fetch(`/api/tasks/${taskId}/create-ticket`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) throw new Error(data?.error ?? "Failed");
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, externalTicketId: data.ticketId, externalTicketUrl: data.ticketUrl, externalProvider: data.provider }
                : t
            )
          );
          succeeded++;
        } catch {
          /* individual failures logged silently; final toast shows count */
        }
      })
    );
    setBulkCreating(false);
    setSelectedIds(new Set());
    if (succeeded > 0) toast.success(`Created ${succeeded} ticket${succeeded !== 1 ? "s" : ""}`);
    if (succeeded < ids.length) toast.error(`${ids.length - succeeded} ticket(s) failed`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={meetingFilter} onValueChange={setMeetingFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Linked meeting" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All meetings</SelectItem>
            {meetings.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={dueDateFilter}
          onChange={(e) => setDueDateFilter(e.target.value)}
          className="w-40"
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPriorityFilter("all");
              setMeetingFilter("all");
              setDueDateFilter("");
            }}
          >
            Clear filters
          </Button>
        )}

        <div className="flex-1" />
        {selectedIds.size > 0 && connectedProviders.length > 0 && (
          connectedProviders.length === 1 ? (
            <Button
              size="sm"
              variant="outline"
              disabled={bulkCreating}
              onClick={() => handleBulkCreateTickets(connectedProviders[0])}
            >
              {bulkCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
              Create tickets for {selectedIds.size} selected
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={bulkCreating}>
                  {bulkCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
                  Create tickets for {selectedIds.size} selected
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {connectedProviders.map((p) => (
                  <DropdownMenuItem key={p} onClick={() => handleBulkCreateTickets(p)}>
                    {p === "jira" ? "Create Jira tickets" : "Create Linear issues"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}
        <NewTaskDialog meetings={meetings} onCreated={(task) => setTasks((prev) => [task, ...prev])} />
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col, i) => (
            <TaskColumn
              key={col.id}
              id={col.id}
              label={col.label}
              borderColor={col.borderColor}
              tasks={tasks.filter((t) => t.status === col.id)}
              meetingTitleById={meetingTitleById}
              selectedIds={selectedIds}
              onToggleSelect={(id) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                })
              }
              showTickets={connectedProviders.length > 0}
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function TaskColumn({
  id,
  label,
  borderColor,
  tasks,
  meetingTitleById,
  selectedIds,
  onToggleSelect,
  showTickets,
  style,
}: {
  id: TaskStatus;
  label: string;
  borderColor: string;
  tasks: TaskRow[];
  meetingTitleById: Map<string, string>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  showTickets: boolean;
  style?: React.CSSProperties;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderTopColor: borderColor }}
      className={cn(
        "animate-fade-in-up flex min-h-[240px] flex-col gap-2 rounded-[var(--radius-lg)] border border-t-[3px] border-border bg-[var(--bg-surface)] p-3",
        isOver && "ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{label}</h3>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border-light)] py-8 text-xs text-[var(--text-muted)]">
            No tasks here
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              meetingTitle={task.meetingId ? meetingTitleById.get(task.meetingId) : undefined}
              selected={selectedIds.has(task.id)}
              onToggleSelect={() => onToggleSelect(task.id)}
              showTickets={showTickets}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  meetingTitle,
  selected,
  onToggleSelect,
  showTickets,
}: {
  task: TaskRow;
  meetingTitle?: string;
  selected: boolean;
  onToggleSelect: () => void;
  showTickets: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex cursor-grab flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-card p-3 text-sm shadow-[var(--shadow-card)] transition-colors hover:border-[var(--border-light)] active:cursor-grabbing",
        selected && "ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-start justify-between gap-2" {...listeners} {...attributes}>
        <div className="flex items-start gap-2">
          {showTickets && (
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 shrink-0"
            />
          )}
          <p className="font-medium leading-tight">{task.title}</p>
        </div>
        <TaskPriorityBadge priority={task.priority} />
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {task.dueDate && <span>{format(new Date(task.dueDate), "MMM d")}</span>}
        {task.assignedTo && <span>· {task.assignedTo}</span>}
        {meetingTitle && <span className="truncate">· {meetingTitle}</span>}
        {task.externalTicketId && task.externalTicketUrl && (
          <a
            href={task.externalTicketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[var(--blue-primary)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
            {task.externalTicketId}
          </a>
        )}
      </div>
    </div>
  );
}
