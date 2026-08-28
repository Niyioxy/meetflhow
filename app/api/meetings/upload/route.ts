import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetings, contentTypeEnum, type ContentType } from "@/db/schema";
import { triggerInternalStep } from "@/lib/internal-auth";
import { getWorkspaceMember, getWorkspaceOrThrow } from "@/lib/workspace-auth";
import { isContentTypeAllowed } from "@/lib/organization-types";
import { canRecordMeeting, FREE_TIER_MONTHLY_RECORDINGS } from "@/lib/billing";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  blobUrl: z.string().url(),
  title: z.string().optional(),
  platform: z.string().optional(),
  contentType: z.string().optional(),
  workspaceId: z.string().uuid().nullable().optional(),
  sharedWithWorkspace: z.boolean().optional(),
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

  const { blobUrl, title, platform, workspaceId, sharedWithWorkspace } = parsed.data;
  const contentTypeInput = parsed.data.contentType;
  const contentType: ContentType = contentTypeEnum.includes(contentTypeInput as ContentType)
    ? (contentTypeInput as ContentType)
    : "meeting";

  if (workspaceId) {
    try {
      await getWorkspaceMember(session.user.id, workspaceId);
      const workspace = await getWorkspaceOrThrow(workspaceId);
      if (!isContentTypeAllowed(workspace.organizationType, contentType)) {
        return NextResponse.json(
          { error: `This workspace only supports ${workspace.organizationType} recordings` },
          { status: 403 }
        );
      }
      if (!(await canRecordMeeting(workspace))) {
        return NextResponse.json(
          {
            error: `Free plan limit reached (${FREE_TIER_MONTHLY_RECORDINGS} recordings/month) — upgrade to Team for unlimited recordings.`,
          },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Not a member of that workspace" }, { status: 403 });
    }
  }

  const [meeting] = await db
    .insert(meetings)
    .values({
      userId: session.user.id,
      title: title?.trim() || "Untitled meeting",
      platform: platform || "other",
      contentType,
      status: "transcribing",
      workspaceId: workspaceId ?? null,
      sharedWithWorkspace: workspaceId ? Boolean(sharedWithWorkspace) : false,
      blobUrl,
    })
    .returning();

  try {
    // blobUrl was uploaded directly from the browser to Vercel Blob (see
    // /api/meetings/upload-token), bypassing this function's request body
    // limit. It's a transient handoff only: this blob is deleted by the
    // process-transcript step as soon as Deepgram has consumed it. MeetFlhow
    // never retains raw meeting audio.
    await triggerInternalStep(`/api/meetings/${meeting.id}/process-transcript`, {
      blobUrl,
      userId: session.user.id,
      workspaceId: workspaceId ?? null,
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
