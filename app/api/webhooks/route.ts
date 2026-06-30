import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { webhooks, webhookEventEnum } from "@/db/schema";
import { getWorkspaceMember, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { isValidWebhookUrl } from "@/lib/webhooks-shared";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { WebhookView } from "@/types/webhooks";

function toView(w: typeof webhooks.$inferSelect, includeSecret = false): WebhookView {
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    events: w.events,
    is_active: w.isActive,
    last_triggered_at: w.lastTriggeredAt?.toISOString() ?? null,
    last_status: w.lastStatus,
    created_at: w.createdAt.toISOString(),
    ...(includeSecret ? { secret: w.secret } : {}),
  };
}

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.enum(webhookEventEnum)).min(1),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  try {
    await getWorkspaceMember(session.user.id, workspaceId);
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  const rows = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.workspaceId, workspaceId))
    .orderBy(desc(webhooks.createdAt));

  return NextResponse.json({ webhooks: rows.map((w) => toView(w)) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { workspaceId, name, url, events } = parsed.data;

  if (!isValidWebhookUrl(url)) {
    return NextResponse.json({ error: "Webhook URL must use https://" }, { status: 400 });
  }

  try {
    const member = await getWorkspaceMember(session.user.id, workspaceId);
    requireRole(member, "admin");
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  const [created] = await db
    .insert(webhooks)
    .values({
      workspaceId,
      name,
      url,
      events,
      secret: crypto.randomBytes(32).toString("hex"),
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json({ webhook: toView(created, true) }, { status: 201 });
}
