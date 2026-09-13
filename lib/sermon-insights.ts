import { sql } from "drizzle-orm";
import { db } from "@/db";

function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export interface ScriptureFrequency {
  reference: string;
  count: number;
}

export interface RecentSermon {
  id: string;
  title: string;
  theme: string;
  createdAt: string;
}

export interface SermonInsights {
  sermonCount: number;
  totalHours: number;
  topScriptures: ScriptureFrequency[];
  recentThemes: RecentSermon[];
}

/**
 * Sermon-specific reading of the same data corporate insights uses —
 * "meeting cost" and "decisions made" don't mean anything for a sermon, but
 * the vertical-content generated for sermons (centralTheme, scriptureReferences)
 * does. Returns null when the user has never recorded a sermon, so the card
 * that renders this can disappear entirely for non-church accounts instead
 * of showing an empty state nobody asked for.
 */
export async function getSermonInsights(userId: string): Promise<SermonInsights | null> {
  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(duration_seconds), 0)::int AS seconds
    FROM meetings
    WHERE user_id = ${userId} AND status = 'ready' AND content_type = 'sermon'
  `);
  const countRow = rowsOf<{ count: number; seconds: number }>(countResult)[0];
  const sermonCount = Number(countRow?.count ?? 0);
  if (sermonCount === 0) return null;

  const [scriptureResult, recentResult] = await Promise.all([
    db.execute(sql`
      SELECT ref AS reference, COUNT(*)::int AS count
      FROM meetings m
      JOIN analysis a ON a.meeting_id = m.id
      CROSS JOIN LATERAL jsonb_array_elements_text(a.vertical_content->'scriptureReferences') AS ref
      WHERE m.user_id = ${userId} AND m.status = 'ready' AND m.content_type = 'sermon'
      GROUP BY ref
      ORDER BY count DESC
      LIMIT 5
    `),
    db.execute(sql`
      SELECT m.id, m.title, m.created_at AS created_at, a.vertical_content->>'centralTheme' AS theme
      FROM meetings m
      JOIN analysis a ON a.meeting_id = m.id
      WHERE m.user_id = ${userId} AND m.status = 'ready' AND m.content_type = 'sermon'
        AND a.vertical_content->>'centralTheme' IS NOT NULL
      ORDER BY m.created_at DESC
      LIMIT 5
    `),
  ]);

  return {
    sermonCount,
    totalHours: Math.round((Number(countRow?.seconds ?? 0) / 3600) * 100) / 100,
    topScriptures: rowsOf<{ reference: string; count: number }>(scriptureResult).map((r) => ({
      reference: r.reference,
      count: Number(r.count),
    })),
    recentThemes: rowsOf<{ id: string; title: string; created_at: string; theme: string }>(
      recentResult
    ).map((r) => ({
      id: r.id,
      title: r.title,
      theme: r.theme,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}
