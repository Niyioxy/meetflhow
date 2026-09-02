import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { getMeetingDetail, runAllMeetingAnalyses } from "@/lib/meetings";
import { triggerInternalStep } from "@/lib/internal-auth";
import { logMeetingEvent } from "@/lib/meeting-events";

export async function POST(
  _req: Request,
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

  if (meeting.status !== "failed") {
    return NextResponse.json({ error: "This meeting isn't in a failed state" }, { status: 400 });
  }

  if (meeting.transcript) {
    await logMeetingEvent(meeting.id, "retried", "Retrying analysis");
    waitUntil(
      runAllMeetingAnalyses(meeting.id, meeting.transcript.fullText).catch((error) =>
        console.error("Retry analysis failed", error)
      )
    );
    return NextResponse.json({ accepted: true, retrying: "analysis" });
  }

  if (meeting.blobUrl) {
    await db.update(meetings).set({ status: "transcribing" }).where(eq(meetings.id, meeting.id));
    await logMeetingEvent(meeting.id, "retried", "Retrying transcription");
    try {
      await triggerInternalStep(`/api/meetings/${meeting.id}/process-transcript`, {
        blobUrl: meeting.blobUrl,
        userId: meeting.userId,
        workspaceId: meeting.workspaceId,
      });
    } catch (error) {
      console.error("Retry transcription hand-off failed", error);
      await db.update(meetings).set({ status: "failed" }).where(eq(meetings.id, meeting.id));
      await logMeetingEvent(meeting.id, "failed", "Retry hand-off failed");
      return NextResponse.json({ error: "Failed to retry" }, { status: 500 });
    }
    return NextResponse.json({ accepted: true, retrying: "transcription" });
  }

  return NextResponse.json(
    { error: "Nothing to retry — please re-record or re-upload." },
    { status: 400 }
  );
}
