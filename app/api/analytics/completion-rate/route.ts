import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { getCompletionRate } from "@/lib/completion-rate";

const querySchema = z.object({
  period: z.enum(["week", "month"]).default("week"),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({ period: searchParams.get("period") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const result = await getCompletionRate(session.user.id, parsed.data.period);
  return NextResponse.json(result);
}
