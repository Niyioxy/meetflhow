import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findRecurringMeetings } from "@/lib/zombie-meetings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await findRecurringMeetings(session.user.id);
  return NextResponse.json({ groups });
}
