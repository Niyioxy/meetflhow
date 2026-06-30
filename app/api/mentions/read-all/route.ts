import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markAllMentionsRead } from "@/lib/mentions";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await markAllMentionsRead(session.user.id);
  return NextResponse.json({ success: true });
}
