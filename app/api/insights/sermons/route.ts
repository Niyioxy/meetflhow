import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSermonInsights } from "@/lib/sermon-insights";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const insights = await getSermonInsights(session.user.id);
  return NextResponse.json({ insights });
}
