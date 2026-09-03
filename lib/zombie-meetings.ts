import { db } from "@/db";

export interface RecurringMeetingGroup {
  title: string;
  occurrences: number;
  totalCost: number | null;
  currency: string | null;
  totalDecisions: number;
  totalActionItems: number;
  isZombie: boolean;
  lastOccurredAt: string;
}

const MIN_OCCURRENCES = 3;

/**
 * Titles too generic to mean "the same recurring meeting" — grouping on
 * these would just lump together unrelated one-off recordings that happen
 * to share a lazy default title, not an actual recurring series.
 */
const GENERIC_TITLES = new Set(["untitled meeting", "recorded meeting", "pasted transcript"]);

/**
 * Groups a user's own completed meetings by exact (normalized) title —
 * the simplest proxy for "recurring meeting series" that needs no new
 * schema or explicit series-linking. Flags a group as a "zombie" once it
 * has run 3+ times and produced zero decisions across all of them,
 * regardless of accumulated cost.
 */
export async function findRecurringMeetings(userId: string): Promise<RecurringMeetingGroup[]> {
  const rows = await db.query.meetings.findMany({
    where: (m, { eq }) => eq(m.userId, userId),
    with: { analysis: true, actionItems: true },
  });

  const groups = new Map<string, typeof rows>();
  for (const meeting of rows) {
    if (meeting.status !== "ready") continue;
    const key = meeting.title.trim().toLowerCase();
    if (!key || GENERIC_TITLES.has(key)) continue;
    const list = groups.get(key) ?? [];
    list.push(meeting);
    groups.set(key, list);
  }

  const result: RecurringMeetingGroup[] = [];
  for (const group of Array.from(groups.values())) {
    if (group.length < MIN_OCCURRENCES) continue;

    const totalDecisions = group.reduce((sum, m) => sum + (m.analysis?.decisions?.length ?? 0), 0);
    const totalActionItems = group.reduce((sum, m) => sum + m.actionItems.length, 0);
    const costs = group
      .map((m) => m.calculatedCost?.total_cost)
      .filter((cost): cost is number => typeof cost === "number");
    const totalCost = costs.length > 0 ? Math.round(costs.reduce((a, b) => a + b, 0) * 100) / 100 : null;
    const currency = group.find((m) => m.calculatedCost?.currency)?.calculatedCost?.currency ?? null;
    const lastOccurredAt = group.reduce(
      (latest, m) => (m.createdAt > latest ? m.createdAt : latest),
      group[0].createdAt
    );

    result.push({
      title: group[0].title,
      occurrences: group.length,
      totalCost,
      currency,
      totalDecisions,
      totalActionItems,
      isZombie: totalDecisions === 0,
      lastOccurredAt: lastOccurredAt.toISOString(),
    });
  }

  return result.sort((a, b) => Number(b.isZombie) - Number(a.isZombie) || b.occurrences - a.occurrences);
}
