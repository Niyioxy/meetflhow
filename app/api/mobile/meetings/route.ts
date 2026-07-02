import { NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile-auth";
import { db } from "@/db";
import { meetings, analysis } from "@/db/schema";
import { eq, desc, and, or } from "drizzle-orm";

export async function GET(request: Request) {
  const user = await getMobileUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      platform: meetings.platform,
      status: meetings.status,
      durationSeconds: meetings.durationSeconds,
      createdAt: meetings.createdAt,
      summary: analysis.summary,
      sentiment: analysis.sentiment,
      meetingScore: analysis.meetingScore,
    })
    .from(meetings)
    .leftJoin(analysis, eq(analysis.meetingId, meetings.id))
    .where(
      and(
        eq(meetings.userId, user.id),
        or(eq(meetings.status, "ready"), eq(meetings.status, "analyzing"))
      )
    )
    .orderBy(desc(meetings.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ data: rows, page, limit });
}
