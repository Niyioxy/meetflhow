/**
 * Linear OAuth integration helpers.
 *
 * Setup: create an OAuth application at https://linear.app/settings/api/applications
 * Add redirect URI `${NEXTAUTH_URL}/api/integrations/linear/callback`.
 * Scopes: read write
 * Required env vars:
 *   LINEAR_CLIENT_ID
 *   LINEAR_CLIENT_SECRET
 */
import { db } from "@/db";
import { decrypt } from "@/lib/crypto";
import { signOAuthState, verifyOAuthState } from "@/lib/integrations/oauth-state";
import type { Priority } from "@/db/schema";

const LINEAR_API = "https://api.linear.app";

function getRedirectUri() {
  return `${process.env.NEXTAUTH_URL}/api/integrations/linear/callback`;
}

export function getLinearAuthorizeUrl(workspaceId: string): string {
  const clientId = process.env.LINEAR_CLIENT_ID;
  if (!clientId) throw new Error("LINEAR_CLIENT_ID is not set");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "read write",
    state: signOAuthState("linear", workspaceId),
    actor: "application",
  });
  return `https://linear.app/oauth/authorize?${params.toString()}`;
}

export function verifyLinearState(state: string) {
  return verifyOAuthState("linear", state);
}

export async function exchangeLinearCode(code: string): Promise<{ accessToken: string }> {
  const res = await fetch(`${LINEAR_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.LINEAR_CLIENT_ID!,
      client_secret: process.env.LINEAR_CLIENT_SECRET!,
      redirect_uri: getRedirectUri(),
      code,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Linear token exchange failed: ${data.error ?? "unknown"}`);
  return { accessToken: data.access_token };
}

async function linearGql<T>(accessToken: string, query: string, variables?: object): Promise<T> {
  const res = await fetch(`${LINEAR_API}/graphql`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors[0].message);
  return body.data as T;
}

export async function listLinearTeams(workspaceId: string): Promise<{ id: string; name: string }[]> {
  const row = await db.query.issueTrackerIntegrations.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "linear")),
  });
  if (!row) throw new Error("Linear not connected");

  const data = await linearGql<{ teams: { nodes: { id: string; name: string }[] } }>(
    decrypt(row.accessToken),
    `query { teams { nodes { id name } } }`
  );
  return data.teams.nodes;
}

const PRIORITY_MAP: Record<Priority, number> = { high: 2, medium: 3, low: 4 };

export async function createLinearIssue(
  workspaceId: string,
  params: {
    teamId: string;
    title: string;
    description: string;
    dueDate?: string | null;
    priority?: Priority;
    assigneeEmail?: string | null;
  }
): Promise<{ identifier: string; url: string }> {
  const row = await db.query.issueTrackerIntegrations.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "linear")),
  });
  if (!row) throw new Error("Linear not connected");

  const token = decrypt(row.accessToken);

  let assigneeId: string | null = null;
  if (params.assigneeEmail) {
    try {
      const userData = await linearGql<{ users: { nodes: { id: string; email: string }[] } }>(
        token,
        `query($email: String) { users(filter: { email: { eq: $email } }) { nodes { id email } } }`,
        { email: params.assigneeEmail }
      );
      assigneeId = userData.users.nodes[0]?.id ?? null;
    } catch {
      /* assignee lookup is best-effort */
    }
  }

  const input: Record<string, unknown> = {
    teamId: params.teamId,
    title: params.title,
    description: params.description,
    priority: params.priority ? PRIORITY_MAP[params.priority] : 3,
  };
  if (params.dueDate) input.dueDate = params.dueDate;
  if (assigneeId) input.assigneeId = assigneeId;

  const data = await linearGql<{ issueCreate: { issue: { identifier: string; url: string } } }>(
    token,
    `mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) { issue { identifier url } }
    }`,
    { input }
  );
  return data.issueCreate.issue;
}
