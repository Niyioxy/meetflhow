import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { getTeamDashboard } from "@/lib/team";

const querySchema = z.object({
  period: z.enum(["week", "month", "quarter"]).default("month"),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "manager" && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({ period: searchParams.get("period") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const result = await getTeamDashboard(parsed.data.period);
  return NextResponse.json(result);
}
