import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { format } from "date-fns";
import { getMeetingDetail } from "@/lib/meetings";
import { generateFollowUpEmail } from "@/lib/gemini/follow-up-email";
import { supportedLanguageEnum, type SupportedLanguage } from "@/db/schema";

function parseLanguage(value: unknown): SupportedLanguage | undefined {
  return typeof value === "string" &&
    (supportedLanguageEnum as readonly string[]).includes(value)
    ? (value as SupportedLanguage)
    : undefined;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await getMeetingDetail(params.id, session.user.id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  if (!meeting.analysis) {
    return NextResponse.json(
      { error: "Meeting has no analysis yet" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const language = parseLanguage(body?.language);

  try {
    const email = await generateFollowUpEmail({
      title: meeting.title,
      date: format(new Date(meeting.createdAt), "MMM d, yyyy"),
      summary: meeting.analysis.summary,
      decisions: meeting.analysis.decisions,
      actionItems: meeting.actionItems.map((item) => ({
        task: item.task,
        owner: item.owner,
        deadline: item.deadline,
      })),
      language,
    });

    return NextResponse.json({
      ...email,
      replyTo: session.user.email ?? null,
      recipients: [] as string[],
    });
  } catch (error) {
    console.error("Follow-up email generation failed", error);
    return NextResponse.json(
      { error: "Failed to generate follow-up email" },
      { status: 500 }
    );
  }
}
