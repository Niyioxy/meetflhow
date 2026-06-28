"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, isPast } from "date-fns";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Trash2, ListPlus, ChevronDown, ChevronRight } from "lucide-react";
import type { Priority } from "@/db/schema";

export interface TodoRow {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  dueDate: string | null;
  isComplete: boolean;
}

const PRIORITY_DOT: Record<Priority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

export function TodoList({ initialTodos }: { initialTodos: TodoRow[] }) {
  const router = useRouter();
  const [todos, setTodos] = useState(initialTodos);
  const [quickTitle, setQuickTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const groups = useMemo(() => {
    const today: TodoRow[] = [];
    const upcoming: TodoRow[] = [];
    const noDate: TodoRow[] = [];

    for (const todo of todos) {
      if (!todo.dueDate) {
        noDate.push(todo);
      } else if (isToday(new Date(todo.dueDate)) || isPast(new Date(todo.dueDate))) {
        today.push(todo);
      } else {
        upcoming.push(todo);
      }
    }
    return { today, upcoming, noDate };
  }, [todos]);

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;

    setAdding(true);
    setQuickTitle("");
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to add todo");
      const data = await res.json();
      setTodos((prev) => [data.todo, ...prev]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setQuickTitle(title);
    } finally {
      setAdding(false);
    }
  }

  async function toggleComplete(todo: TodoRow) {
    setTodos((prev) =>
      prev.map((t) => (t.id === todo.id ? { ...t, isComplete: !t.isComplete } : t))
    );
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isComplete: !todo.isComplete }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, isComplete: todo.isComplete } : t))
      );
      toast.error("Failed to update todo");
    }
  }

  async function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to delete todo");
    }
  }

  async function promoteTodo(id: string) {
    try {
      const res = await fetch(`/api/todos/${id}/promote`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to promote todo");
      setTodos((prev) => prev.filter((t) => t.id !== id));
      toast.success("Moved to Task Board", {
        action: { label: "View board", onClick: () => router.push("/tasks") },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function deleteCompleted() {
    const completedIds = new Set(todos.filter((t) => t.isComplete).map((t) => t.id));
    if (completedIds.size === 0) return;
    setTodos((prev) => prev.filter((t) => !completedIds.has(t.id)));
    try {
      const res = await fetch("/api/todos", { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to delete completed todos");
    }
  }

  const hasCompleted = todos.some((t) => t.isComplete);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleQuickAdd} className="flex gap-2">
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a todo and press Enter..."
          disabled={adding}
        />
        <Button type="submit" disabled={adding || !quickTitle.trim()}>
          Add
        </Button>
      </form>

      {hasCompleted && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={deleteCompleted} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete completed
          </Button>
        </div>
      )}

      <TodoGroup
        title="Today"
        todos={groups.today}
        onToggle={toggleComplete}
        onDelete={deleteTodo}
        onPromote={promoteTodo}
      />
      <TodoGroup
        title="Upcoming"
        todos={groups.upcoming}
        onToggle={toggleComplete}
        onDelete={deleteTodo}
        onPromote={promoteTodo}
      />
      <TodoGroup
        title="No date"
        todos={groups.noDate}
        onToggle={toggleComplete}
        onDelete={deleteTodo}
        onPromote={promoteTodo}
      />
    </div>
  );
}

function TodoGroup({
  title,
  todos,
  onToggle,
  onDelete,
  onPromote,
}: {
  title: string;
  todos: TodoRow[];
  onToggle: (todo: TodoRow) => void;
  onDelete: (id: string) => void;
  onPromote: (id: string) => void;
}) {
  if (todos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="flex flex-col gap-1">
        {todos.map((todo) => (
          <TodoRowItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} onPromote={onPromote} />
        ))}
      </div>
    </div>
  );
}

function TodoRowItem({
  todo,
  onToggle,
  onDelete,
  onPromote,
}: {
  todo: TodoRow;
  onToggle: (todo: TodoRow) => void;
  onDelete: (id: string) => void;
  onPromote: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = Boolean(todo.notes || todo.dueDate);

  return (
    <div className="flex flex-col rounded-md border bg-card px-3 py-2">
      <div className="flex items-center gap-3">
        <Checkbox checked={todo.isComplete} onCheckedChange={() => onToggle(todo)} />
        <button
          type="button"
          onClick={() => hasDetails && setExpanded((e) => !e)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              PRIORITY_DOT[todo.priority]
            )}
          />
          <span
            className={cn(
              "text-sm transition-all",
              todo.isComplete && "text-muted-foreground line-through"
            )}
          >
            {todo.title}
          </span>
          {todo.dueDate && (
            <Badge variant="secondary" className="text-[10px]">
              {format(new Date(todo.dueDate), "MMM d")}
            </Badge>
          )}
          {hasDetails && (
            expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <Button variant="ghost" size="icon-sm" title="Move to Task Board" onClick={() => onPromote(todo.id)}>
          <ListPlus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => onDelete(todo.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {expanded && todo.notes && (
        <p className="ml-7 mt-1 text-xs text-muted-foreground">{todo.notes}</p>
      )}
    </div>
  );
}
