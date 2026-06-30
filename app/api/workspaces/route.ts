import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createWorkspace, listUserWorkspaces } from "@/lib/workspaces";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

const bodySchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await listUserWorkspaces(session.user.id);
  return NextResponse.json({ workspaces });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A workspace name is required" }, { status: 400 });
  }

  try {
    const workspace = await createWorkspace(session.user.id, parsed.data.name);
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
