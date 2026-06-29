import { createHash } from "crypto";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { generateInsightsSummary } from "@/lib/gemini/insights-summary";
import type { InsightPeriod, InsightsCache, InsightsResponse, InsightsSummary } from "@/types/insights";

function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export function resolvePeriodWindows(period: InsightPeriod, from?: string, to?: string) {
  const isCustom = Boolean(from && to);
  const end = to ? new Date(to) : new Date();
  let start: Date;
  if (from) {
    start = new Date(from);
  } else {
    const days = period === "week" ? 7 : period === "month" ? 30 : 90;
    start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  }
  const lengthMs = Math.max(end.getTime() - start.getTime(), 1);
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - lengthMs);
  return { start, end, prevStart, prevEnd, isCustom };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

interface PeriodTotals {
  total_meetings: number;
  total_seconds: number;
  total_cost: number;
  avg_score: number | null;
  decisions_made: number;
}

async function getPeriodTotals(userId: string, start: Date, end: Date): Promise<PeriodTotals> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_meetings,
      COALESCE(SUM(m.duration_seconds), 0)::int AS total_seconds,
      COALESCE(SUM((m.calculated_cost->>'total_cost')::numeric), 0)::float AS total_cost,
      AVG((a.meeting_score->>'overall_score')::numeric)::float AS avg_score,
      COALESCE(SUM(COALESCE(array_length(a.decisions, 1), 0)), 0)::int AS decisions_made
    FROM meetings m
    LEFT JOIN analysis a ON a.meeting_id = m.id
    WHERE m.user_id = ${userId}
      AND m.status = 'ready'
      AND m.created_at >= ${start}
      AND m.created_at < ${end}
  `);
  const row = rowsOf<Record<string, unknown>>(result)[0];
  return {
    total_meetings: Number(row?.total_meetings ?? 0),
    total_seconds: Number(row?.total_seconds ?? 0),
    total_cost: Number(row?.total_cost ?? 0),
    avg_score: row?.avg_score == null ? null : Number(row.avg_score),
    decisions_made: Number(row?.decisions_made ?? 0),
  };
}

async function getActionItemsGenerated(userId: string, start: Date, end: Date): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM action_items ai
    JOIN meetings m ON m.id = ai.meeting_id
    WHERE m.user_id = ${userId}
      AND m.status = 'ready'
      AND m.created_at >= ${start}
      AND m.created_at < ${end}
  `);
  return Number(rowsOf<{ count: number }>(result)[0]?.count ?? 0);
}

async function getMeetingsPerPlatform(userId: string, start: Date, end: Date) {
  const result = await db.execute(sql`
    SELECT platform, COUNT(*)::int AS count
    FROM meetings
    WHERE user_id = ${userId}
      AND status = 'ready'
      AND created_at >= ${start}
      AND created_at < ${end}
    GROUP BY platform
  `);
  return rowsOf<{ platform: string; count: number }>(result).map((r) => ({
    platform: r.platform,
    count: Number(r.count),
  }));
}

async function getHoursPerDay(userId: string, start: Date, end: Date) {
  const result = await db.execute(sql`
    SELECT date_trunc('day', created_at) AS day, COALESCE(SUM(duration_seconds), 0)::float AS seconds
    FROM meetings
    WHERE user_id = ${userId}
      AND status = 'ready'
      AND created_at >= ${start}
      AND created_at < ${end}
    GROUP BY day
    ORDER BY day
  `);
  return rowsOf<{ day: string; seconds: number }>(result).map((r) => ({
    date: new Date(r.day).toISOString().slice(0, 10),
    hours: Math.round((Number(r.seconds) / 3600) * 100) / 100,
  }));
}

async function getMostExpensiveMeeting(userId: string, start: Date, end: Date) {
  const result = await db.execute(sql`
    SELECT id, title, (calculated_cost->>'total_cost')::numeric AS cost
    FROM meetings
    WHERE user_id = ${userId}
      AND status = 'ready'
      AND calculated_cost IS NOT NULL
      AND created_at >= ${start}
      AND created_at < ${end}
    ORDER BY cost DESC
    LIMIT 1
  `);
  const row = rowsOf<{ id: string; title: string; cost: number }>(result)[0];
  return row ? { id: row.id, title: row.title, cost: Number(row.cost) } : null;
}

async function getMostProductiveMeeting(userId: string, start: Date, end: Date) {
  const result = await db.execute(sql`
    SELECT m.id, m.title, (a.meeting_score->>'overall_score')::numeric AS score
    FROM meetings m
    JOIN analysis a ON a.meeting_id = m.id
    WHERE m.user_id = ${userId}
      AND m.status = 'ready'
      AND a.meeting_score IS NOT NULL
      AND m.created_at >= ${start}
      AND m.created_at < ${end}
    ORDER BY score DESC
    LIMIT 1
  `);
  const row = rowsOf<{ id: string; title: string; score: number }>(result)[0];
  return row ? { id: row.id, title: row.title, score: Number(row.score) } : null;
}

async function getScoreTrend(userId: string, start: Date, end: Date) {
  const result = await db.execute(sql`
    SELECT m.id, m.created_at AS date, m.title, (a.meeting_score->>'overall_score')::numeric AS score
    FROM meetings m
    JOIN analysis a ON a.meeting_id = m.id
    WHERE m.user_id = ${userId}
      AND m.status = 'ready'
      AND a.meeting_score IS NOT NULL
      AND m.created_at >= ${start}
      AND m.created_at < ${end}
    ORDER BY m.created_at ASC
  `);
  return rowsOf<{ id: string; date: string; title: string; score: number }>(result).map((r) => ({
    id: r.id,
    date: new Date(r.date).toISOString(),
    title: r.title,
    score: Number(r.score),
  }));
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function getHeatmap(userId: string, start: Date, end: Date) {
  const result = await db.execute(sql`
    SELECT EXTRACT(DOW FROM scheduled_at)::int AS day, EXTRACT(HOUR FROM scheduled_at)::int AS hour, COUNT(*)::int AS count
    FROM scheduled_meetings
    WHERE user_id = ${userId}
      AND scheduled_at >= ${start}
      AND scheduled_at < ${end}
    GROUP BY day, hour
  `);
  const heatmap = rowsOf<{ day: number; hour: number; count: number }>(result).map((r) => ({
    day: Number(r.day),
    hour: Number(r.hour),
    count: Number(r.count),
  }));

  const byDay = new Map<number, number>();
  const byHour = new Map<number, number>();
  for (const cell of heatmap) {
    byDay.set(cell.day, (byDay.get(cell.day) ?? 0) + cell.count);
    byHour.set(cell.hour, (byHour.get(cell.hour) ?? 0) + cell.count);
  }

  const busiestDay = Array.from(byDay.entries()).sort((a, b) => b[1] - a[1])[0];
  const busiestHour = Array.from(byHour.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    heatmap,
    busiest_day: busiestDay ? DAY_NAMES[busiestDay[0]] : null,
    busiest_hour: busiestHour ? formatHour(busiestHour[0]) : null,
  };
}

function formatHour(hour: number): string {
  const period = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${period}`;
}

export async function getInsights(
  userId: string,
  period: InsightPeriod,
  from?: string,
  to?: string
): Promise<InsightsResponse> {
  const { start, end, prevStart, prevEnd } = resolvePeriodWindows(period, from, to);

  const [
    totals,
    prevTotals,
    actionItemsGenerated,
    meetingsPerPlatform,
    hoursPerDay,
    mostExpensiveMeeting,
    mostProductiveMeeting,
    scoreTrend,
    heatmapData,
  ] = await Promise.all([
    getPeriodTotals(userId, start, end),
    getPeriodTotals(userId, prevStart, prevEnd),
    getActionItemsGenerated(userId, start, end),
    getMeetingsPerPlatform(userId, start, end),
    getHoursPerDay(userId, start, end),
    getMostExpensiveMeeting(userId, start, end),
    getMostProductiveMeeting(userId, start, end),
    getScoreTrend(userId, start, end),
    getHeatmap(userId, start, end),
  ]);

  let timeTrend: InsightsResponse["time_trend"] = "stable";
  if (totals.avg_score != null && prevTotals.avg_score != null) {
    const delta = totals.avg_score - prevTotals.avg_score;
    if (delta >= 5) timeTrend = "improving";
    else if (delta <= -5) timeTrend = "worsening";
  }

  const totalHours = Math.round((totals.total_seconds / 3600) * 100) / 100;
  const prevTotalHours = Math.round((prevTotals.total_seconds / 3600) * 100) / 100;

  return {
    total_meetings: totals.total_meetings,
    total_hours: totalHours,
    total_cost: totals.total_cost,
    avg_meeting_duration:
      totals.total_meetings > 0 ? Math.round(totals.total_seconds / totals.total_meetings) : 0,
    avg_meeting_score: totals.avg_score,
    hours_per_day: hoursPerDay,
    meetings_per_platform: meetingsPerPlatform,
    busiest_day: heatmapData.busiest_day,
    busiest_hour: heatmapData.busiest_hour,
    most_expensive_meeting: mostExpensiveMeeting,
    most_productive_meeting: mostProductiveMeeting,
    action_items_generated: actionItemsGenerated,
    decisions_made: totals.decisions_made,
    time_trend: timeTrend,
    score_trend: scoreTrend,
    heatmap: heatmapData.heatmap,
    changes: {
      total_meetings: pctChange(totals.total_meetings, prevTotals.total_meetings),
      total_hours: pctChange(totalHours, prevTotalHours),
      total_cost: pctChange(totals.total_cost, prevTotals.total_cost),
      avg_meeting_score:
        totals.avg_score != null && prevTotals.avg_score != null
          ? pctChange(totals.avg_score, prevTotals.avg_score)
          : null,
    },
  };
}

function computeStatsSignature(stats: InsightsResponse): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        total_meetings: stats.total_meetings,
        total_hours: stats.total_hours,
        total_cost: stats.total_cost,
        avg_meeting_score: stats.avg_meeting_score,
        action_items_generated: stats.action_items_generated,
        decisions_made: stats.decisions_made,
      })
    )
    .digest("hex");
}

export async function getOrGenerateInsightsSummary(
  userId: string,
  period: InsightPeriod,
  stats: InsightsResponse,
  isCustomRange: boolean
): Promise<InsightsSummary> {
  const signature = computeStatsSignature(stats);

  if (!isCustomRange) {
    const user = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) });
    const cache = user?.insightsCache ?? {};
    const cached = cache[period];
    if (cached && cached.signature === signature) {
      return cached.summary;
    }

    const summary = await generateInsightsSummary(JSON.stringify(stats));
    const nextCache: InsightsCache = {
      ...cache,
      [period]: { signature, generated_at: new Date().toISOString(), summary },
    };
    await db.update(users).set({ insightsCache: nextCache }).where(eq(users.id, userId));
    return summary;
  }

  return generateInsightsSummary(JSON.stringify(stats));
}
