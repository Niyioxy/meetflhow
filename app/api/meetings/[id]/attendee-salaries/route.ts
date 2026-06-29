import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { ensureTranscriptOwnership, saveAttendeeSalaries, runMeetingCostAnalysis } from "@/lib/meetings";
import { currencyEnum } from "@/types/cost";

const bodySchema = z.object({
  attendees: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        annual_salary: z.number().positive(),
        currency: z.enum(currencyEnum),
      })
    )
    .min(1),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await ensureTranscriptOwnership(params.id, session.user.id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await saveAttendeeSalaries(meeting.id, parsed.data.attendees);

  if (!meeting.durationSeconds) {
    return NextResponse.json({ calculatedCost: null });
  }

  try {
    const calculatedCost = await runMeetingCostAnalysis(meeting.id);
    return NextResponse.json({ calculatedCost });
  } catch (error) {
    console.error("Cost calculation failed", error);
    return NextResponse.json({ calculatedCost: null });
  }
}
