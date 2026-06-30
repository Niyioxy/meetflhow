import { NextResponse } from "next/server";
import { db } from "@/db";
import type { WorkspaceRole } from "@/db/schema";
import { roleAtLeast } from "@/lib/workspace-roles";

export { roleAtLeast };

export class WorkspaceAccessError extends Error {
  status: number;
  constructor(message = "You do not have access to this workspace", status = 403) {
    super(message);
    this.status = status;
  }
}

export async function getWorkspaceMember(userId: string, workspaceId: string) {
  const member = await db.query.workspaceMembers.findFirst({
    where: (m, { and, eq }) => and(eq(m.workspaceId, workspaceId), eq(m.userId, userId)),
  });
  if (!member) throw new WorkspaceAccessError();
  return member;
}

export function requireRole(member: { role: WorkspaceRole }, minRole: WorkspaceRole) {
  if (!roleAtLeast(member.role, minRole)) {
    throw new WorkspaceAccessError(`This action requires the ${minRole} role or higher`);
  }
}

/** Maps a WorkspaceAccessError (or unknown error) to a JSON error response. */
export function workspaceErrorResponse(error: unknown) {
  if (error instanceof WorkspaceAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Unexpected workspace error", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
