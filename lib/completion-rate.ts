import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { CompletionRateResponse } from "@/types/insights";

function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export async function getCompletionRate(
  userId: string,
  period: "week" | "month"
): Promise<CompletionRateResponse> {
  const days = period === "week" ? 7 : 30;
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const totalsResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ai.status = 'done')::int AS completed,
      COUNT(*) FILTER (WHERE ai.status != 'done' AND ai.due_date IS NOT NULL AND ai.due_date < CURRENT_DATE)::int AS overdue,
      COUNT(*) FILTER (WHERE ai.status != 'done' AND (ai.due_date IS NULL OR ai.due_date >= CURRENT_DATE))::int AS pending,
      (AVG(EXTRACT(EPOCH FROM (ai.completed_at - ai.created_at)) / 86400) FILTER (WHERE ai.completed_at IS NOT NULL))::float AS avg_completion_days
    FROM action_items ai
    JOIN meetings m ON m.id = ai.meeting_id
    WHERE m.user_id = ${userId} AND ai.created_at >= ${start}
  `);
  const totalsRow = rowsOf(totalsResult)[0];

  const total = Number(totalsRow?.total ?? 0);
  const completed = Number(totalsRow?.completed ?? 0);
  const overdue = Number(totalsRow?.overdue ?? 0);
  const pending = Number(totalsRow?.pending ?? 0);
  const avgCompletionDays =
    totalsRow?.avg_completion_days == null ? null : Number(totalsRow.avg_completion_days);

  const byMeetingResult = await db.execute(sql`
    SELECT m.id AS meeting_id, m.title AS meeting_title,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ai.status = 'done')::int AS completed
    FROM action_items ai
    JOIN meetings m ON m.id = ai.meeting_id
    WHERE m.user_id = ${userId} AND ai.created_at >= ${start}
    GROUP BY m.id, m.title
    ORDER BY (COUNT(*) FILTER (WHERE ai.status = 'done')::float / COUNT(*)) ASC
  `);
  const byMeeting = rowsOf<{
    meeting_id: string;
    meeting_title: string;
    total: number;
    completed: number;
  }>(byMeetingResult).map((r) => ({
    meeting_id: r.meeting_id,
    meeting_title: r.meeting_title,
    total: Number(r.total),
    completed: Number(r.completed),
    rate: Number(r.total) > 0 ? Math.round((Number(r.completed) / Number(r.total)) * 1000) / 10 : 0,
  }));

  const byAssigneeResult = await db.execute(sql`
    SELECT ai.owner AS name,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE ai.status = 'done')::int AS completed
    FROM action_items ai
    JOIN meetings m ON m.id = ai.meeting_id
    WHERE m.user_id = ${userId} AND ai.created_at >= ${start} AND ai.owner IS NOT NULL
    GROUP BY ai.owner
    ORDER BY total DESC
  `);
  const byAssignee = rowsOf<{ name: string; total: number; completed: number }>(byAssigneeResult).map(
    (r) => ({
      name: r.name,
      total: Number(r.total),
      completed: Number(r.completed),
      rate: Number(r.total) > 0 ? Math.round((Number(r.completed) / Number(r.total)) * 1000) / 10 : 0,
    })
  );

  const overdueItemsResult = await db.execute(sql`
    SELECT ai.id, ai.task, m.id AS meeting_id, m.title AS meeting_title, ai.due_date, ai.owner AS assignee,
      (CURRENT_DATE - ai.due_date) AS days_overdue
    FROM action_items ai
    JOIN meetings m ON m.id = ai.meeting_id
    WHERE m.user_id = ${userId} AND ai.created_at >= ${start}
      AND ai.status != 'done' AND ai.due_date IS NOT NULL AND ai.due_date < CURRENT_DATE
    ORDER BY ai.due_date ASC
  `);
  const overdueItems = rowsOf<{
    id: string;
    task: string;
    meeting_id: string;
    meeting_title: string;
    due_date: string;
    assignee: string | null;
    days_overdue: number;
  }>(overdueItemsResult).map((r) => ({
    id: r.id,
    task: r.task,
    meeting_id: r.meeting_id,
    meeting_title: r.meeting_title,
    due_date: r.due_date,
    assignee: r.assignee,
    days_overdue: Number(r.days_overdue),
  }));

  return {
    total_action_items: total,
    completed,
    overdue,
    pending,
    completion_rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
    avg_completion_days: avgCompletionDays,
    by_meeting: byMeeting,
    by_assignee: byAssignee,
    overdue_items: overdueItems,
  };
}
