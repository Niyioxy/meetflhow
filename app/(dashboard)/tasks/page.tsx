import { auth } from "@/auth";
import { db } from "@/db";
import { meetings, tasks } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { TaskBoard } from "@/components/tasks/task-board";

export default async function TasksPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [taskRows, meetingRows] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt)),
    db.select().from(meetings).where(eq(meetings.userId, userId)).orderBy(desc(meetings.createdAt)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Track work across your meetings, from backlog to done.
        </p>
      </div>

      <TaskBoard
        initialTasks={taskRows.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          assignedTo: t.assignedTo,
          meetingId: t.meetingId,
          externalTicketId: t.externalTicketId,
          externalTicketUrl: t.externalTicketUrl,
          externalProvider: t.externalProvider,
        }))}
        meetings={meetingRows.map((m) => ({ id: m.id, title: m.title }))}
      />
    </div>
  );
}
