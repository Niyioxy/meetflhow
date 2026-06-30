import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetings, transcripts } from "@/db/schema";
import { transcribeAudio } from "@/lib/deepgram/transcribe";
import { runAllMeetingAnalyses, wordCount } from "@/lib/meetings";
import { getWorkspaceMember } from "@/lib/workspace-auth";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const title = (formData.get("title") as string | null)?.trim();
  const platform = (formData.get("platform") as string | null) || "other";
  const workspaceId = (formData.get("workspaceId") as string | null) || null;
  const sharedWithWorkspace = formData.get("sharedWithWorkspace") === "true";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (workspaceId) {
    try {
      await getWorkspaceMember(session.user.id, workspaceId);
    } catch {
      return NextResponse.json({ error: "Not a member of that workspace" }, { status: 403 });
    }
  }

  const [meeting] = await db
    .insert(meetings)
    .values({
      userId: session.user.id,
      title: title || file.name || "Untitled meeting",
      platform,
      status: "uploading",
      workspaceId,
      sharedWithWorkspace: workspaceId ? sharedWithWorkspace : false,
    })
    .returning();

  try {
    await db
      .update(meetings)
      .set({ status: "transcribing" })
      .where(eq(meetings.id, meeting.id));

    const transcription = await transcribeAudio(file);

    await db.insert(transcripts).values({
      meetingId: meeting.id,
      fullText: transcription.text,
      language: transcription.language,
      wordCount: wordCount(transcription.text),
    });

    if (transcription.durationSeconds) {
      await db
        .update(meetings)
        .set({ durationSeconds: Math.round(transcription.durationSeconds) })
        .where(eq(meetings.id, meeting.id));
    }

    await runAllMeetingAnalyses(meeting.id, transcription.text);

    return NextResponse.json({ meetingId: meeting.id, status: "ready" });
  } catch (error) {
    console.error("Upload pipeline failed", error);
    await db
      .update(meetings)
      .set({ status: "failed" })
      .where(eq(meetings.id, meeting.id));
    return NextResponse.json(
      { error: "Failed to process meeting", meetingId: meeting.id },
      { status: 500 }
    );
  }
}
