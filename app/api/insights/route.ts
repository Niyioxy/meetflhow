import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { getInsights, getOrGenerateInsightsSummary, resolvePeriodWindows } from "@/lib/insights";

const querySchema = z.object({
  period: z.enum(["week", "month", "quarter"]).default("week"),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    period: searchParams.get("period") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const { period, from, to } = parsed.data;
  const stats = await getInsights(session.user.id, period, from, to);
  const { isCustom } = resolvePeriodWindows(period, from, to);

  let summary;
  try {
    summary = await getOrGenerateInsightsSummary(session.user.id, period, stats, isCustom);
  } catch (error) {
    console.error("Insights summary generation failed", error);
    summary = null;
  }

  return NextResponse.json({ ...stats, summary });
}
