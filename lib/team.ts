import { sql, isNotNull, and, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { meetings, users } from "@/db/schema";
import type { BackToBackWarning, CollaborationPair, TeamDashboardResponse, TeamMemberStats } from "@/types/team";

function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(count, 1);
}

async function getMemberMeetingStats(start: Date, end: Date) {
  const result = await db.execute(sql`
    SELECT u.id, u.name, u.email, u.image,
      COUNT(DISTINCT m.id)::int AS total_meetings,
      COALESCE(SUM(m.duration_seconds), 0)::int AS total_seconds,
      AVG((a.meeting_score->>'overall_score')::numeric)::float AS avg_score,
      MAX(m.created_at) AS last_meeting,
      MODE() WITHIN GROUP (ORDER BY m.platform) AS most_common_platform
    FROM users u
    LEFT JOIN meetings m ON m.user_id = u.id AND m.status = 'ready' AND m.created_at >= ${start} AND m.created_at < ${end}
    LEFT JOIN analysis a ON a.meeting_id = m.id
    GROUP BY u.id, u.name, u.email, u.image
  `);
  return rowsOf<{
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    total_meetings: number;
    total_seconds: number;
    avg_score: number | null;
    last_meeting: string | null;
    most_common_platform: string | null;
  }>(result);
}

async function getMemberCompletionStats(start: Date, end: Date) {
  const result = await db.execute(sql`
    SELECT u.id,
      COUNT(ai.id)::int AS total_items,
      COUNT(ai.id) FILTER (WHERE ai.status = 'done')::int AS completed_items
    FROM users u
    LEFT JOIN meetings m ON m.user_id = u.id AND m.created_at >= ${start} AND m.created_at < ${end}
    LEFT JOIN action_items ai ON ai.meeting_id = m.id
    GROUP BY u.id
  `);
  return rowsOf<{ id: string; total_items: number; completed_items: number }>(result);
}

async function getTeamOverlap(start: Date, end: Date) {
  const result = await db.execute(sql`
    WITH ordered AS (
      SELECT user_id, scheduled_at,
        scheduled_at + (duration_minutes || ' minutes')::interval AS ends_at,
        LAG(scheduled_at + (duration_minutes || ' minutes')::interval) OVER (PARTITION BY user_id ORDER BY scheduled_at) AS prev_ends_at
      FROM scheduled_meetings
      WHERE scheduled_at >= ${start} AND scheduled_at < ${end}
    )
    SELECT
      (COUNT(*) FILTER (WHERE prev_ends_at IS NOT NULL AND scheduled_at <= prev_ends_at + interval '5 minutes'))::float
        / NULLIF(COUNT(*), 0) * 100 AS overlap_pct
    FROM ordered
  `);
  const row = rowsOf<{ overlap_pct: number | null }>(result)[0];
  return row?.overlap_pct == null ? 0 : Math.round(Number(row.overlap_pct) * 10) / 10;
}

async function getBackToBackWarnings(start: Date, end: Date): Promise<BackToBackWarning[]> {
  const result = await db.execute(sql`
    WITH ordered AS (
      SELECT user_id, scheduled_at, scheduled_at::date AS day,
        scheduled_at + (duration_minutes || ' minutes')::interval AS ends_at,
        LAG(scheduled_at + (duration_minutes || ' minutes')::interval) OVER (PARTITION BY user_id ORDER BY scheduled_at) AS prev_ends_at
      FROM scheduled_meetings
      WHERE scheduled_at >= ${start} AND scheduled_at < ${end}
    ),
    flagged AS (
      SELECT *, (prev_ends_at IS NOT NULL AND scheduled_at <= prev_ends_at + interval '5 minutes') AS is_back_to_back
      FROM ordered
    )
    SELECT user_id, day, COUNT(*)::int AS meeting_count
    FROM flagged
    GROUP BY user_id, day
    HAVING COUNT(*) >= 3 AND COUNT(*) FILTER (WHERE is_back_to_back) >= 2
    ORDER BY day DESC
  `);
  const rows = rowsOf<{ user_id: string; day: string; meeting_count: number }>(result);
  if (rows.length === 0) return [];

  const memberRows = await db.select({ id: users.id, name: users.name }).from(users);
  const nameById = new Map(memberRows.map((m) => [m.id, m.name]));

  return rows.map((r) => ({
    user_id: r.user_id,
    name: nameById.get(r.user_id) ?? null,
    day: new Date(r.day).toISOString().slice(0, 10),
    count: Number(r.meeting_count),
  }));
}

async function getCollaborationMap(start: Date, end: Date): Promise<CollaborationPair[]> {
  const rows = await db
    .select({ userId: meetings.userId, attendeeSalaries: meetings.attendeeSalaries })
    .from(meetings)
    .where(and(isNotNull(meetings.attendeeSalaries), gte(meetings.createdAt, start), lt(meetings.createdAt, end)));

  if (rows.length === 0) return [];

  const allUsers = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
  const userByEmail = new Map(allUsers.map((u) => [u.email.toLowerCase(), u]));
  const userById = new Map(allUsers.map((u) => [u.id, u]));

  const pairCounts = new Map<string, { person_a: string; person_b: string; shared_meetings: number }>();

  function bump(a: string, b: string) {
    if (a === b) return;
    const key = [a, b].sort().join("::");
    const existing = pairCounts.get(key);
    if (existing) {
      existing.shared_meetings += 1;
    } else {
      const [person_a, person_b] = [a, b].sort();
      pairCounts.set(key, { person_a, person_b, shared_meetings: 1 });
    }
  }

  for (const row of rows) {
    const owner = userById.get(row.userId);
    if (!owner) continue;
    const matchedAttendees = (row.attendeeSalaries ?? [])
      .map((a) => userByEmail.get(a.email.toLowerCase()))
      .filter((u): u is { id: string; name: string | null; email: string } => Boolean(u) && u!.id !== owner.id);

    const participants = [owner, ...matchedAttendees];
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        bump(participants[i].name ?? participants[i].email, participants[j].name ?? participants[j].email);
      }
    }
  }

  return Array.from(pairCounts.values()).sort((a, b) => b.shared_meetings - a.shared_meetings);
}

export async function getTeamDashboard(period: "week" | "month" | "quarter"): Promise<TeamDashboardResponse> {
  const days = period === "week" ? 7 : period === "month" ? 30 : 90;
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const workingDayHours = countWeekdays(start, end) * 8;

  const [meetingStats, completionStats, overlap, backToBack, collaborationMap] = await Promise.all([
    getMemberMeetingStats(start, end),
    getMemberCompletionStats(start, end),
    getTeamOverlap(start, end),
    getBackToBackWarnings(start, end),
    getCollaborationMap(start, end),
  ]);

  const completionById = new Map(completionStats.map((c) => [c.id, c]));

  const members: TeamMemberStats[] = meetingStats.map((m) => {
    const completion = completionById.get(m.id);
    const totalHours = Math.round((Number(m.total_seconds) / 3600) * 100) / 100;
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      image: m.image,
      total_meetings: Number(m.total_meetings),
      total_hours: totalHours,
      avg_score: m.avg_score == null ? null : Number(m.avg_score),
      completion_rate:
        completion && Number(completion.total_items) > 0
          ? Math.round((Number(completion.completed_items) / Number(completion.total_items)) * 1000) / 10
          : null,
      most_common_platform: m.most_common_platform,
      last_meeting: m.last_meeting ? new Date(m.last_meeting).toISOString() : null,
      meeting_time_pct: Math.round(Math.min((totalHours / workingDayHours) * 100, 100) * 10) / 10,
    };
  });

  const teamMeetings = members.reduce((sum, m) => sum + m.total_meetings, 0);
  const teamHours = Math.round(members.reduce((sum, m) => sum + m.total_hours, 0) * 100) / 100;
  const scored = members.filter((m) => m.avg_score != null);
  const avgScore =
    scored.length > 0 ? Math.round((scored.reduce((sum, m) => sum + (m.avg_score ?? 0), 0) / scored.length) * 10) / 10 : null;

  const costResult = await db.execute(sql`
    SELECT COALESCE(SUM((calculated_cost->>'total_cost')::numeric), 0)::float AS total_cost
    FROM meetings
    WHERE status = 'ready' AND created_at >= ${start} AND created_at < ${end}
  `);
  const totalCost = Number(rowsOf<{ total_cost: number }>(costResult)[0]?.total_cost ?? 0);

  return {
    members,
    team_totals: { meetings: teamMeetings, hours: teamHours, cost: totalCost, avg_score: avgScore },
    meeting_overlap: overlap,
    collaboration_map: collaborationMap,
    back_to_back_warnings: backToBack,
  };
}
