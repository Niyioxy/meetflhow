import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { actionItems, issueTrackerProviderEnum } from "@/db/schema";
import { createJiraIssue } from "@/lib/integrations/jira";
import { createLinearIssue } from "@/lib/integrations/linear";
import { eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  provider: z.enum(issueTrackerProviderEnum),
  projectId: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await db.query.actionItems.findFirst({
    where: (a, { eq }) => eq(a.id, params.id),
    with: { meeting: true },
  });
  if (!item || item.meeting.userId !== session.user.id) {
    return NextResponse.json({ error: "Action item not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { provider, projectId } = parsed.data;
  const workspaceId = item.meeting.workspaceId;
  if (!workspaceId) return NextResponse.json({ error: "Meeting is not in a workspace" }, { status: 400 });

  const description = `From MeetFlhow meeting: ${item.meeting.title}\n\n${process.env.NEXTAUTH_URL}/meetings/${item.meeting.id}`;

  try {
    let ticketId: string;
    let ticketUrl: string;

    if (provider === "jira") {
      const integration = await db.query.issueTrackerIntegrations.findFirst({
        where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "jira")),
      });
      if (!integration?.siteUrl) return NextResponse.json({ error: "Jira site not configured" }, { status: 400 });
      const resolvedProjectId = projectId ?? integration.defaultProjectId;
      if (!resolvedProjectId) return NextResponse.json({ error: "No default Jira project set — configure one in Settings → Integrations" }, { status: 400 });

      const result = await createJiraIssue(workspaceId, integration.siteUrl, {
        projectId: resolvedProjectId,
        summary: item.task,
        description,
        dueDate: item.dueDate,
        assigneeEmail: null,
      });
      ticketId = result.key;
      ticketUrl = result.url;
    } else {
      const linearIntegration = await db.query.issueTrackerIntegrations.findFirst({
        where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "linear")),
      });
      const resolvedTeamId = projectId ?? linearIntegration?.defaultProjectId;
      if (!resolvedTeamId) return NextResponse.json({ error: "No default Linear team set — configure one in Settings → Integrations" }, { status: 400 });

      const result = await createLinearIssue(workspaceId, {
        teamId: resolvedTeamId,
        title: item.task,
        description,
        dueDate: item.dueDate,
        priority: item.priority,
      });
      ticketId = result.identifier;
      ticketUrl = result.url;
    }

    await db
      .update(actionItems)
      .set({ externalTicketId: ticketId, externalTicketUrl: ticketUrl, externalProvider: provider })
      .where(eq(actionItems.id, params.id));

    return NextResponse.json({ ticketId, ticketUrl, provider });
  } catch (error) {
    console.error("Failed to create ticket", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create ticket" },
      { status: 502 }
    );
  }
}
