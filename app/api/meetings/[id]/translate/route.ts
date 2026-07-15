import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { translations, supportedLanguageEnum } from "@/db/schema";
import { getMeetingDetail } from "@/lib/meetings";
import { translateMeetingContent } from "@/lib/gemini/translate";

const bodySchema = z.object({
  target_language: z.enum(supportedLanguageEnum),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid target_language" }, { status: 400 });
  }
  const targetLanguage = parsed.data.target_language;

  const meeting = await getMeetingDetail(params.id, session.user.id);
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const cached = await db.query.translations.findFirst({
    where: and(
      eq(translations.meetingId, meeting.id),
      eq(translations.targetLanguage, targetLanguage)
    ),
  });

  if (cached) {
    return NextResponse.json({
      summary: cached.translatedSummary,
      transcript_segments: cached.translatedTranscript ?? [],
      action_items: cached.translatedActionItems ?? [],
      cached: true,
    });
  }

  const result = await translateMeetingContent({
    targetLanguage,
    summary: meeting.analysis?.summary ?? null,
    transcriptSegments: meeting.transcript?.speakerSegments ?? [],
    actionItems: meeting.actionItems.map((item) => ({
      task: item.task,
      owner: item.owner,
      deadline: item.deadline,
    })),
  });

  await db
    .insert(translations)
    .values({
      meetingId: meeting.id,
      targetLanguage,
      translatedSummary: result.summary,
      translatedTranscript: result.transcriptSegments,
      translatedActionItems: result.actionItems,
    })
    .onConflictDoUpdate({
      target: [translations.meetingId, translations.targetLanguage],
      set: {
        translatedSummary: result.summary,
        translatedTranscript: result.transcriptSegments,
        translatedActionItems: result.actionItems,
      },
    });

  return NextResponse.json({
    summary: result.summary,
    transcript_segments: result.transcriptSegments,
    action_items: result.actionItems,
    cached: false,
  });
}
