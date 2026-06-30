import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { webhooks, webhookEventEnum } from "@/db/schema";
import { getWorkspaceMember, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { isValidWebhookUrl } from "@/lib/webhooks-shared";
import { eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(webhookEventEnum)).min(1).optional(),
  isActive: z.boolean().optional(),
});

async function getOwnedWebhook(id: string) {
  return db.query.webhooks.findFirst({ where: (w, { eq: eqOp }) => eqOp(w.id, id) });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhook = await getOwnedWebhook(params.id);
  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  try {
    const member = await getWorkspaceMember(session.user.id, webhook.workspaceId);
    requireRole(member, "admin");
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (parsed.data.url && !isValidWebhookUrl(parsed.data.url)) {
    return NextResponse.json({ error: "Webhook URL must use https://" }, { status: 400 });
  }

  const updates: Partial<typeof webhooks.$inferInsert> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.url !== undefined) updates.url = parsed.data.url;
  if (parsed.data.events !== undefined) updates.events = parsed.data.events;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const [updated] = await db
    .update(webhooks)
    .set(updates)
    .where(eq(webhooks.id, params.id))
    .returning();

  return NextResponse.json({
    webhook: {
      id: updated.id,
      name: updated.name,
      url: updated.url,
      events: updated.events,
      is_active: updated.isActive,
      last_triggered_at: updated.lastTriggeredAt?.toISOString() ?? null,
      last_status: updated.lastStatus,
      created_at: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhook = await getOwnedWebhook(params.id);
  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  try {
    const member = await getWorkspaceMember(session.user.id, webhook.workspaceId);
    requireRole(member, "admin");
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  await db.delete(webhooks).where(eq(webhooks.id, params.id));

  return NextResponse.json({ success: true });
}
