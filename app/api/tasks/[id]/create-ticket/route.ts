import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { tasks, issueTrackerProviderEnum } from "@/db/schema";
import { createJiraIssue } from "@/lib/integrations/jira";
import { createLinearIssue } from "@/lib/integrations/linear";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const bodySchema = z.object({
  provider: z.enum(issueTrackerProviderEnum),
  projectId: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await db.query.tasks.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.id, params.id), e(t.userId, session.user.id)),
    with: { meeting: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { provider, projectId } = parsed.data;
  const workspaceId = task.meeting?.workspaceId ?? null;
  if (!workspaceId) return NextResponse.json({ error: "Task is not linked to a workspace meeting" }, { status: 400 });

  const meetingLink = task.meetingId
    ? `\n\nMeeting: ${process.env.NEXTAUTH_URL}/meetings/${task.meetingId}`
    : "";
  const description = `Task from MeetFlhow${meetingLink}`;

  try {
    let ticketId: string;
    let ticketUrl: string;

    if (provider === "jira") {
      const integration = await db.query.issueTrackerIntegrations.findFirst({
        where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "jira")),
      });
      if (!integration?.siteUrl) return NextResponse.json({ error: "Jira site not configured" }, { status: 400 });

      const result = await createJiraIssue(workspaceId, integration.siteUrl, {
        projectId,
        summary: task.title,
        description: task.description ? `${task.description}${meetingLink}` : description,
        dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
        assigneeEmail: null,
      });
      ticketId = result.key;
      ticketUrl = result.url;
    } else {
      const result = await createLinearIssue(workspaceId, {
        teamId: projectId,
        title: task.title,
        description: task.description ? `${task.description}${meetingLink}` : description,
        dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
        priority: task.priority,
      });
      ticketId = result.identifier;
      ticketUrl = result.url;
    }

    await db
      .update(tasks)
      .set({ externalTicketId: ticketId, externalTicketUrl: ticketUrl, externalProvider: provider })
      .where(and(eq(tasks.id, params.id), eq(tasks.userId, session.user.id)));

    return NextResponse.json({ ticketId, ticketUrl, provider });
  } catch (error) {
    console.error("Failed to create ticket from task", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create ticket" },
      { status: 502 }
    );
  }
}
