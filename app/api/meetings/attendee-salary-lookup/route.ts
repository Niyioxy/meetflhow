import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const emails = (searchParams.get("emails") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json({ salaries: [] });
  }

  const rows = await db
    .select({ attendeeSalaries: meetings.attendeeSalaries })
    .from(meetings)
    .where(and(eq(meetings.userId, session.user.id), isNotNull(meetings.attendeeSalaries)))
    .orderBy(desc(meetings.createdAt));

  const found = new Map<string, { name: string; email: string; annual_salary: number; currency: string }>();
  for (const row of rows) {
    for (const attendee of row.attendeeSalaries ?? []) {
      const key = attendee.email.toLowerCase();
      if (emails.includes(key) && !found.has(key)) {
        found.set(key, attendee);
      }
    }
  }

  return NextResponse.json({ salaries: Array.from(found.values()) });
}
