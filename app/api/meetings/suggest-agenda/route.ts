import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { getRecentMeetingSummaries } from "@/lib/meetings";
import { generateAgendaSuggestion } from "@/lib/gemini/agenda";

const bodySchema = z.object({
  title: z.string().min(1),
  attendees: z.array(z.string()).default([]),
  scheduled_at: z.string().optional(),
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

  const { title, attendees } = parsed.data;

  const pastMeetings = await getRecentMeetingSummaries(session.user.id, 5);
  const pastSummaries =
    pastMeetings
      .map((m) => `- ${m.title}: ${m.analysis!.summary}`)
      .join("\n") || "No past meeting history available.";

  try {
    const agenda = await generateAgendaSuggestion({ title, attendees, pastSummaries });
    return NextResponse.json({ agenda });
  } catch (error) {
    console.error("Agenda suggestion failed", error);
    return NextResponse.json(
      { error: "Failed to generate agenda suggestion" },
      { status: 500 }
    );
  }
}
