import { auth } from "@/auth";
import { db } from "@/db";
import { todos } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { TodoList } from "@/components/todos/todo-list";

export default async function TodosPage() {
  const session = await auth();
  const userId = session!.user.id;

  const rows = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, userId))
    .orderBy(desc(todos.createdAt));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Todos</h1>
        <p className="text-sm text-muted-foreground">Quick personal checklist, separate from your task board.</p>
      </div>

      <TodoList
        initialTodos={rows.map((t) => ({
          id: t.id,
          title: t.title,
          notes: t.notes,
          priority: t.priority,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          isComplete: t.isComplete,
        }))}
      />
    </div>
  );
}
