import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetings, contentTypeEnum, type ContentType } from "@/db/schema";
import { triggerInternalStep } from "@/lib/internal-auth";
import { getWorkspaceMember } from "@/lib/workspace-auth";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const title = (formData.get("title") as string | null)?.trim();
  const platform = (formData.get("platform") as string | null) || "other";
  const contentTypeInput = formData.get("contentType") as string | null;
  const contentType: ContentType = contentTypeEnum.includes(contentTypeInput as ContentType)
    ? (contentTypeInput as ContentType)
    : "meeting";
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
      contentType,
      status: "uploading",
      workspaceId,
      sharedWithWorkspace: workspaceId ? sharedWithWorkspace : false,
    })
    .returning();

  try {
    // Transient handoff only: this blob is deleted by the process-transcript
    // step as soon as Deepgram has consumed it. MeetFlhow never retains raw
    // meeting audio.
    const blob = await put(`meeting-uploads/${meeting.id}-${file.name || "recording"}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    await db.update(meetings).set({ status: "transcribing" }).where(eq(meetings.id, meeting.id));

    await triggerInternalStep(`/api/meetings/${meeting.id}/process-transcript`, {
      blobUrl: blob.url,
      userId: session.user.id,
      workspaceId,
    });

    return NextResponse.json({ meetingId: meeting.id, status: "transcribing" });
  } catch (error) {
    console.error("Upload hand-off failed", error);
    await db.update(meetings).set({ status: "failed" }).where(eq(meetings.id, meeting.id));
    return NextResponse.json(
      { error: "Failed to start processing meeting", meetingId: meeting.id },
      { status: 500 }
    );
  }
}
