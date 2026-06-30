import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { workspaceRoleEnum } from "@/db/schema";
import { createInvite } from "@/lib/workspaces";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

const bodySchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(workspaceRoleEnum).default("member"),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    const invite = await createInvite(params.id, session.user.id, parsed.data.email, parsed.data.role);
    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
