import { NextResponse } from "next/server";
import { getInvitePreview } from "@/lib/workspaces";
import { workspaceErrorResponse } from "@/lib/workspace-auth";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const invite = await getInvitePreview(params.token);
    return NextResponse.json({ invite });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
