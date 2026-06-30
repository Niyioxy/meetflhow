import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { webhookLogs } from "@/db/schema";
import { getWorkspaceMember, workspaceErrorResponse } from "@/lib/workspace-auth";
import { desc, eq } from "drizzle-orm";
import type { WebhookLogView } from "@/types/webhooks";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
    await getWorkspaceMember(session.user.id, webhook.workspaceId);
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  const rows = await db
    .select()
    .from(webhookLogs)
    .where(eq(webhookLogs.webhookId, params.id))
    .orderBy(desc(webhookLogs.createdAt))
    .limit(10);

  const logs: WebhookLogView[] = rows.map((r) => ({
    id: r.id,
    event: r.event,
    success: r.success,
    response_status: r.responseStatus,
    created_at: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ logs });
}
