import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { askMeetings } from "@/lib/search/ask-meetings";

export const maxDuration = 60;

const bodySchema = z.object({
  question: z.string().min(1).max(1000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await askMeetings(parsed.data.question, session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Ask meetings failed", error);
    return NextResponse.json({ error: "Failed to answer your question" }, { status: 500 });
  }
}
