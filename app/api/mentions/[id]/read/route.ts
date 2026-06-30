import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { markMentionRead } from "@/lib/mentions";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await markMentionRead(params.id, session.user.id);
  return NextResponse.json({ success: true });
}
