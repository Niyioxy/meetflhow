import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { workspaceRoleEnum } from "@/db/schema";
import { changeMemberRole, removeMember } from "@/lib/workspaces";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

const bodySchema = z.object({ role: z.enum(workspaceRoleEnum) });

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid role is required" }, { status: 400 });
  }

  try {
    await changeMemberRole(params.id, session.user.id, params.userId, parsed.data.role);
    return NextResponse.json({ success: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await removeMember(params.id, session.user.id, params.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
