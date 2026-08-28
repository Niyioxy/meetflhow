import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { and, desc, eq, inArray, or } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const memberWorkspaceIds = (
    await db.query.workspaceMembers.findMany({
      where: (m, { eq }) => eq(m.userId, userId),
      columns: { workspaceId: true },
    })
  ).map((m) => m.workspaceId);

  const rows = await db
    .select()
    .from(meetings)
    .where(
      memberWorkspaceIds.length > 0
        ? or(
            eq(meetings.userId, userId),
            and(eq(meetings.sharedWithWorkspace, true), inArray(meetings.workspaceId, memberWorkspaceIds))
          )
        : eq(meetings.userId, userId)
    )
    .orderBy(desc(meetings.createdAt));

  return NextResponse.json({ meetings: rows });
}
