/**
 * Jira (Atlassian OAuth 2.0 – 3LO) integration helpers.
 *
 * Setup: create an OAuth 2.0 (3LO) app at https://developer.atlassian.com/console/myapps/
 * Add the redirect URI `${NEXTAUTH_URL}/api/integrations/jira/callback` and request scopes:
 *   write:jira-work  read:jira-work  offline_access
 * Required env vars (from the app's settings):
 *   JIRA_CLIENT_ID
 *   JIRA_CLIENT_SECRET
 */
import { db } from "@/db";
import { issueTrackerIntegrations } from "@/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { signOAuthState, verifyOAuthState } from "@/lib/integrations/oauth-state";
import { eq, and } from "drizzle-orm";

const ATLASSIAN_AUTH = "https://auth.atlassian.com";
const ATLASSIAN_API = "https://api.atlassian.com";

function getRedirectUri() {
  return `${process.env.NEXTAUTH_URL}/api/integrations/jira/callback`;
}

export function getJiraAuthorizeUrl(workspaceId: string): string {
  const clientId = process.env.JIRA_CLIENT_ID;
  if (!clientId) throw new Error("JIRA_CLIENT_ID is not set");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "write:jira-work read:jira-work offline_access",
    audience: "api.atlassian.com",
    prompt: "consent",
    state: signOAuthState("jira", workspaceId),
  });
  return `${ATLASSIAN_AUTH}/authorize?${params.toString()}`;
}

export function verifyJiraState(state: string) {
  return verifyOAuthState("jira", state);
}

interface AtlassianTokens {
  accessToken: string;
  refreshToken: string;
}

export async function exchangeJiraCode(code: string): Promise<AtlassianTokens> {
  const res = await fetch(`${ATLASSIAN_AUTH}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      code,
      redirect_uri: getRedirectUri(),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Jira token exchange failed: ${data.error ?? "unknown"}`);
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

async function refreshJiraTokens(workspaceId: string): Promise<string> {
  const row = await db.query.issueTrackerIntegrations.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "jira")),
  });
  if (!row?.refreshToken) throw new Error("No Jira refresh token stored");

  const res = await fetch(`${ATLASSIAN_AUTH}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.JIRA_CLIENT_ID,
      client_secret: process.env.JIRA_CLIENT_SECRET,
      refresh_token: decrypt(row.refreshToken),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Jira token refresh failed: ${data.error ?? "unknown"}`);

  await db
    .update(issueTrackerIntegrations)
    .set({
      accessToken: encrypt(data.access_token),
      refreshToken: data.refresh_token ? encrypt(data.refresh_token) : row.refreshToken,
    })
    .where(
      and(
        eq(issueTrackerIntegrations.workspaceId, workspaceId),
        eq(issueTrackerIntegrations.provider, "jira")
      )
    );

  return data.access_token;
}

async function jiraFetch(
  workspaceId: string,
  cloudId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const row = await db.query.issueTrackerIntegrations.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "jira")),
  });
  if (!row) throw new Error("Jira not connected");

  let token = decrypt(row.accessToken);
  let res = await fetch(`${ATLASSIAN_API}/ex/jira/${cloudId}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });

  if (res.status === 401) {
    token = await refreshJiraTokens(workspaceId);
    res = await fetch(`${ATLASSIAN_API}/ex/jira/${cloudId}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
    });
  }
  return res;
}

export async function getJiraSite(accessToken: string): Promise<{ id: string; name: string; url: string }> {
  const res = await fetch(`${ATLASSIAN_API}/oauth/token/accessible-resources`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok || !Array.isArray(data) || data.length === 0) {
    throw new Error("No accessible Jira sites found");
  }
  const site = data[0];
  return { id: site.id, name: site.name, url: site.url };
}

export async function listJiraProjects(workspaceId: string, cloudId: string) {
  const res = await jiraFetch(workspaceId, cloudId, "/rest/api/3/project/search?maxResults=50");
  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to list Jira projects: ${data.message ?? "unknown"}`);
  return (data.values ?? []).map((p: { id: string; key: string; name: string }) => ({
    id: p.id,
    key: p.key,
    name: p.name,
  }));
}

export async function createJiraIssue(
  workspaceId: string,
  cloudId: string,
  params: {
    projectId: string;
    summary: string;
    description: string;
    dueDate?: string | null;
    assigneeEmail?: string | null;
  }
): Promise<{ key: string; url: string }> {
  const fields: Record<string, unknown> = {
    project: { id: params.projectId },
    summary: params.summary,
    issuetype: { name: "Task" },
    description: {
      type: "doc",
      version: 1,
      content: [{ type: "paragraph", content: [{ type: "text", text: params.description }] }],
    },
  };

  if (params.dueDate) fields.duedate = params.dueDate;

  if (params.assigneeEmail) {
    const searchRes = await jiraFetch(
      workspaceId,
      cloudId,
      `/rest/api/3/user/search?query=${encodeURIComponent(params.assigneeEmail)}`
    );
    const users = await searchRes.json().catch(() => []);
    if (Array.isArray(users) && users.length > 0) {
      fields.assignee = { accountId: users[0].accountId };
    }
  }

  const res = await jiraFetch(workspaceId, cloudId, "/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to create Jira issue: ${data.errors ? JSON.stringify(data.errors) : "unknown"}`);

  const site = await db.query.issueTrackerIntegrations.findFirst({
    where: (t, { and: a, eq: e }) => a(e(t.workspaceId, workspaceId), e(t.provider, "jira")),
  });
  const baseUrl = site?.siteUrl?.startsWith("http") ? site.siteUrl : `https://${site?.siteName}`;
  return {
    key: data.key,
    url: `${baseUrl}/browse/${data.key}`,
  };
}
