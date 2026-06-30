/**
 * Slack integration helpers.
 *
 * Setup: create a Slack App at https://api.slack.com/apps, add the
 * "OAuth & Permissions" scopes chat:write, channels:read, channels:join,
 * and set the redirect URL to `${NEXTAUTH_URL}/api/integrations/slack/callback`.
 * Required env vars (from the app's "Basic Information" page):
 *   SLACK_CLIENT_ID
 *   SLACK_CLIENT_SECRET
 *   SLACK_SIGNING_SECRET (reserved for verifying inbound Slack requests; unused for now)
 */
import { format } from "date-fns";
import { db } from "@/db";
import { decrypt } from "@/lib/crypto";
import { signOAuthState, verifyOAuthState } from "@/lib/integrations/oauth-state";
import type { analysis, actionItems, meetings } from "@/db/schema";

type Analysis = typeof analysis.$inferSelect;
type ActionItem = typeof actionItems.$inferSelect;
type Meeting = typeof meetings.$inferSelect;

const SLACK_API = "https://slack.com/api";

function getRedirectUri(): string {
  return `${process.env.NEXTAUTH_URL}/api/integrations/slack/callback`;
}

export function getSlackAuthorizeUrl(workspaceId: string): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) throw new Error("SLACK_CLIENT_ID is not set");

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "chat:write,channels:read,channels:join",
    redirect_uri: getRedirectUri(),
    state: signOAuthState("slack", workspaceId),
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export function verifyState(state: string): { workspaceId: string } | null {
  return verifyOAuthState("slack", state);
}

interface SlackOAuthResult {
  accessToken: string;
  teamId: string;
  teamName: string;
  botUserId: string;
}

export async function exchangeSlackCode(code: string): Promise<SlackOAuthResult> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Slack client credentials are not set");

  const res = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack OAuth exchange failed: ${data.error ?? "unknown error"}`);
  }

  return {
    accessToken: data.access_token,
    teamId: data.team?.id,
    teamName: data.team?.name,
    botUserId: data.bot_user_id,
  };
}

export async function listSlackChannels(
  accessToken: string
): Promise<{ id: string; name: string }[]> {
  const res = await fetch(
    `${SLACK_API}/conversations.list?types=public_channel,private_channel&limit=200&exclude_archived=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Failed to list Slack channels: ${data.error ?? "unknown error"}`);
  }
  return (data.channels ?? []).map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));
}

function buildMeetingSummaryBlocks(
  meeting: Pick<Meeting, "id" | "title" | "platform" | "durationSeconds" | "createdAt">,
  analysis: Pick<Analysis, "summary"> | null,
  actionItems: Pick<ActionItem, "task" | "owner" | "deadline">[],
  options: { includeSummary: boolean; includeActionItems: boolean }
) {
  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `📋 ${meeting.title}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Date:*\n${format(new Date(meeting.createdAt), "MMM d, yyyy")}` },
        {
          type: "mrkdwn",
          text: `*Duration:*\n${
            meeting.durationSeconds ? `${Math.round(meeting.durationSeconds / 60)} min` : "—"
          }`,
        },
        { type: "mrkdwn", text: `*Platform:*\n${meeting.platform}` },
      ],
    },
  ];

  if (options.includeSummary && analysis?.summary) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Summary*\n${analysis.summary}` },
    });
  }

  if (options.includeActionItems && actionItems.length > 0) {
    const list = actionItems
      .map((item) => {
        const owner = item.owner ? ` — @${item.owner}` : "";
        const due = item.deadline ? ` — due ${item.deadline}` : "";
        return `☐ ${item.task}${owner}${due}`;
      })
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*✅ Action Items*\n${list}` },
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "View full details in MeetFlhow" }],
  });
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Open Meeting", emoji: true },
        url: `${process.env.NEXTAUTH_URL}/meetings/${meeting.id}`,
      },
    ],
  });

  return blocks;
}

async function postMeetingSummaryToSlack(params: {
  accessToken: string;
  channelId: string;
  meeting: Pick<Meeting, "id" | "title" | "platform" | "durationSeconds" | "createdAt">;
  analysis: Pick<Analysis, "summary"> | null;
  actionItems: Pick<ActionItem, "task" | "owner" | "deadline">[];
  includeSummary: boolean;
  includeActionItems: boolean;
}): Promise<{ ok: boolean; error?: string; channelName?: string }> {
  const { accessToken, channelId, meeting, analysis, actionItems, includeSummary, includeActionItems } =
    params;

  // Best-effort: the bot must be a member of the channel to post. channels:join
  // covers public channels; private channels require a human to invite the bot.
  await fetch(`${SLACK_API}/conversations.join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel: channelId }),
  }).catch(() => null);

  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: channelId,
      text: `New meeting summary: ${meeting.title}`,
      blocks: buildMeetingSummaryBlocks(meeting, analysis, actionItems, {
        includeSummary,
        includeActionItems,
      }),
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    return { ok: false, error: data.error ?? "unknown error" };
  }
  return { ok: true, channelName: data.channel };
}

/**
 * Looks up the workspace's Slack connection and channel for `meetingId` and
 * posts the summary. Used by both the manual "Post to Slack" button and the
 * auto-post hook in runAllMeetingAnalyses. Never throws.
 */
export async function postMeetingToSlack(
  meetingId: string,
  options: { includeSummary?: boolean; includeActionItems?: boolean } = {}
): Promise<{ ok: boolean; error?: string; channelName?: string }> {
  const meeting = await db.query.meetings.findFirst({
    where: (m, { eq }) => eq(m.id, meetingId),
    with: { analysis: true, actionItems: true },
  });
  if (!meeting) return { ok: false, error: "Meeting not found" };
  if (!meeting.workspaceId) return { ok: false, error: "This meeting isn't part of a workspace" };

  const integration = await db.query.slackIntegrations.findFirst({
    where: (s, { eq }) => eq(s.workspaceId, meeting.workspaceId!),
  });
  if (!integration) return { ok: false, error: "Slack is not connected for this workspace" };

  const settings = await db.query.slackPostSettings.findFirst({
    where: (s, { eq }) => eq(s.workspaceId, meeting.workspaceId!),
  });

  const channelId = settings?.channelId ?? integration.defaultChannelId;
  if (!channelId) return { ok: false, error: "No Slack channel selected for this workspace" };

  try {
    const accessToken = decrypt(integration.accessToken);
    return await postMeetingSummaryToSlack({
      accessToken,
      channelId,
      meeting,
      analysis: meeting.analysis,
      actionItems: meeting.actionItems,
      includeSummary: options.includeSummary ?? true,
      includeActionItems: options.includeActionItems ?? true,
    });
  } catch (error) {
    console.error("Failed to post meeting to Slack", error);
    return { ok: false, error: "Failed to post to Slack" };
  }
}
