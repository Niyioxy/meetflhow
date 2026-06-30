/**
 * Notion integration helpers.
 *
 * Setup: create an integration at https://www.notion.so/my-integrations,
 * enable "Public integration" + OAuth, and set the redirect URI to
 * `${NEXTAUTH_URL}/api/integrations/notion/callback`.
 * Required env vars (from the integration's settings page):
 *   NOTION_CLIENT_ID
 *   NOTION_CLIENT_SECRET
 */
import { Client } from "@notionhq/client";
import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import { db } from "@/db";
import { meetings as meetingsTable } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { signOAuthState, verifyOAuthState } from "@/lib/integrations/oauth-state";
import { eq } from "drizzle-orm";
import type { analysis, actionItems, meetings } from "@/db/schema";

type Analysis = typeof analysis.$inferSelect;
type ActionItem = typeof actionItems.$inferSelect;
type Meeting = typeof meetings.$inferSelect;

function getRedirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/integrations/notion/callback`;
}

export function getNotionAuthorizeUrl(workspaceId: string): string {
  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) throw new Error("NOTION_CLIENT_ID is not set");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    owner: "user",
    redirect_uri: getRedirectUri(),
    state: signOAuthState("notion", workspaceId),
  });
  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

export function verifyState(state: string): { workspaceId: string } | null {
  return verifyOAuthState("notion", state);
}

interface NotionOAuthResult {
  accessToken: string;
  workspaceName: string | null;
  workspaceIcon: string | null;
}

export async function exchangeNotionCode(code: string): Promise<NotionOAuthResult> {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Notion client credentials are not set");

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Notion OAuth exchange failed: ${data.error ?? "unknown error"}`);
  }

  return {
    accessToken: data.access_token,
    workspaceName: data.workspace_name ?? null,
    workspaceIcon: data.workspace_icon ?? null,
  };
}

export async function listNotionDatabases(
  accessToken: string
): Promise<{ id: string; name: string }[]> {
  const client = new Client({ auth: accessToken });
  const res = await client.search({
    filter: { property: "object", value: "database" },
    page_size: 100,
  });

  return res.results.map((db) => {
    const titleProp = "title" in db ? db.title : [];
    const name = Array.isArray(titleProp) && titleProp[0]?.plain_text ? titleProp[0].plain_text : "Untitled";
    return { id: db.id, name };
  });
}

/**
 * Creates a Notion page in `databaseId` for `meeting`, with Summary, Key
 * Decisions, Action Items (as to-dos), and a collapsed Transcript toggle.
 * Matches properties by name when the target database has them.
 */
export async function createNotionMeetingPage(params: {
  accessToken: string;
  databaseId: string;
  meeting: Pick<Meeting, "id" | "title" | "platform" | "durationSeconds" | "createdAt" | "status">;
  analysis: Pick<Analysis, "summary" | "decisions"> | null;
  actionItems: Pick<ActionItem, "task" | "owner" | "deadline">[];
  transcriptText: string | null;
  existingPageId?: string | null;
}): Promise<{ pageId: string; url: string }> {
  const { accessToken, databaseId, meeting, analysis, actionItems, transcriptText, existingPageId } = params;
  const client = new Client({ auth: accessToken });

  const properties: NonNullable<CreatePageParameters["properties"]> = {
    Name: { title: [{ text: { content: meeting.title } }] },
  };

  const dbInfo = await client.databases.retrieve({ database_id: databaseId }).catch(() => null);
  const dbProps = dbInfo && "properties" in dbInfo ? dbInfo.properties : {};

  if (dbProps?.Date?.type === "date") {
    properties.Date = { date: { start: new Date(meeting.createdAt).toISOString() } };
  }
  if (dbProps?.Platform?.type === "select") {
    properties.Platform = { select: { name: meeting.platform } };
  }
  if (dbProps?.Duration?.type === "number") {
    properties.Duration = { number: meeting.durationSeconds ? Math.round(meeting.durationSeconds / 60) : null };
  }
  if (dbProps?.Status?.type === "select") {
    properties.Status = { select: { name: meeting.status } };
  }

  const children: NonNullable<CreatePageParameters["children"]> = [
    { object: "block", type: "heading_2", heading_2: { rich_text: [{ text: { content: "Summary" } }] } },
    {
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ text: { content: analysis?.summary || "No summary available." } }] },
    },
  ];

  if (analysis?.decisions && analysis.decisions.length > 0) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ text: { content: "Key Decisions" } }] },
    });
    for (const decision of analysis.decisions) {
      children.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ text: { content: decision } }] },
      });
    }
  }

  if (actionItems.length > 0) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ text: { content: "Action Items" } }] },
    });
    for (const item of actionItems) {
      const owner = item.owner ? ` (${item.owner})` : "";
      const due = item.deadline ? ` — due ${item.deadline}` : "";
      children.push({
        object: "block",
        type: "to_do",
        to_do: { rich_text: [{ text: { content: `${item.task}${owner}${due}` } }], checked: false },
      });
    }
  }

  if (transcriptText) {
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ text: { content: "Transcript" } }] },
    });
    children.push({
      object: "block",
      type: "toggle",
      toggle: {
        rich_text: [{ text: { content: "Full transcript" } }],
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: { rich_text: [{ text: { content: transcriptText.slice(0, 2000) } }] },
          },
        ],
      },
    });
  }

  if (existingPageId) {
    await client.pages.update({ page_id: existingPageId, properties });
    return { pageId: existingPageId, url: `https://notion.so/${existingPageId.replace(/-/g, "")}` };
  }

  const page = await client.pages.create({
    parent: { database_id: databaseId },
    properties,
    children,
  });

  return { pageId: page.id, url: "url" in page ? page.url : `https://notion.so/${page.id.replace(/-/g, "")}` };
}

/**
 * Looks up the workspace's Notion connection for `meetingId` and creates
 * (or updates) the page. Used by the manual "Push to Notion" button.
 */
export async function pushMeetingToNotion(
  meetingId: string
): Promise<{ ok: boolean; error?: string; pageId?: string; url?: string }> {
  const meeting = await db.query.meetings.findFirst({
    where: (m, { eq }) => eq(m.id, meetingId),
    with: { analysis: true, actionItems: true, transcript: true },
  });
  if (!meeting) return { ok: false, error: "Meeting not found" };
  if (!meeting.workspaceId) return { ok: false, error: "This meeting isn't part of a workspace" };

  const integration = await db.query.notionIntegrations.findFirst({
    where: (n, { eq }) => eq(n.workspaceId, meeting.workspaceId!),
  });
  if (!integration) return { ok: false, error: "Notion is not connected for this workspace" };
  if (!integration.databaseId) return { ok: false, error: "No Notion database selected for this workspace" };

  try {
    const result = await createNotionMeetingPage({
      accessToken: decrypt(integration.accessToken),
      databaseId: integration.databaseId,
      meeting,
      analysis: meeting.analysis,
      actionItems: meeting.actionItems,
      transcriptText: meeting.transcript?.fullText ?? null,
      existingPageId: meeting.notionPageId,
    });

    if (!meeting.notionPageId) {
      await db
        .update(meetingsTable)
        .set({ notionPageId: result.pageId })
        .where(eq(meetingsTable.id, meetingId));
    }

    return { ok: true, pageId: result.pageId, url: result.url };
  } catch (error) {
    console.error("Failed to push meeting to Notion", error);
    return { ok: false, error: "Failed to push to Notion" };
  }
}
