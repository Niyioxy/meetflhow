import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMeetingDetail } from "@/lib/meetings";
import { postMeetingToSlack } from "@/lib/integrations/slack";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await getMeetingDetail(params.id, session.user.id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const result = await postMeetingToSlack(params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to post to Slack" }, { status: 400 });
  }

  return NextResponse.json({ success: true, channel: result.channelName });
}
