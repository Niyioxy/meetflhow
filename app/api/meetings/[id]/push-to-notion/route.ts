import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMeetingDetail } from "@/lib/meetings";
import { pushMeetingToNotion } from "@/lib/integrations/notion";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await getMeetingDetail(params.id, session.user.id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const result = await pushMeetingToNotion(params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to push to Notion" }, { status: 400 });
  }

  return NextResponse.json({ success: true, pageId: result.pageId, url: result.url });
}
