import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { getWorkspaceMember, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { sendTestWebhook } from "@/lib/webhooks";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhook = await db.query.webhooks.findFirst({
    where: (w, { eq: eqOp }) => eqOp(w.id, params.id),
  });
  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  try {
    const member = await getWorkspaceMember(session.user.id, webhook.workspaceId);
    requireRole(member, "admin");
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  const result = await sendTestWebhook(webhook.id, webhook.workspaceId);
  if (!result) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
