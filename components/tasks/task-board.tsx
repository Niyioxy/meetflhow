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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { cn } from "@/lib/utils";
import type { Priority, TaskStatus } from "@/db/schema";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  assignedTo: string | null;
  meetingId: string | null;
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
  const [tasks, setTasks] = useState(initialTasks);
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [meetingFilter, setMeetingFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("");

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
  style,
}: {
  id: TaskStatus;
  label: string;
  borderColor: string;
  tasks: TaskRow[];
  meetingTitleById: Map<string, string>;
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
            />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, meetingTitle }: { task: TaskRow; meetingTitle?: string }) {
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
      {...listeners}
      {...attributes}
      className="flex cursor-grab flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-card p-3 text-sm shadow-[var(--shadow-card)] transition-colors hover:border-[var(--border-light)] active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-tight">{task.title}</p>
        <TaskPriorityBadge priority={task.priority} />
      </div>
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {task.dueDate && <span>{format(new Date(task.dueDate), "MMM d")}</span>}
        {task.assignedTo && <span>· {task.assignedTo}</span>}
        {meetingTitle && <span className="truncate">· {meetingTitle}</span>}
      </div>
    </div>
  );
}
