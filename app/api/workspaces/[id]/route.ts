import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { deleteWorkspace, getWorkspaceDetail, updateWorkspace } from "@/lib/workspaces";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

const patchSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspace = await getWorkspaceDetail(params.id, session.user.id);
    return NextResponse.json({ workspace });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A workspace name is required" }, { status: 400 });
  }

  try {
    const workspace = await updateWorkspace(params.id, session.user.id, parsed.data);
    return NextResponse.json({ workspace });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteWorkspace(params.id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
