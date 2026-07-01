import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { issueTrackerIntegrations } from "@/db/schema";
import { exchangeJiraCode, getJiraSite, verifyJiraState } from "@/lib/integrations/jira";
import { encrypt } from "@/lib/crypto";

function redirectTo(status: "connected" | "error", message?: string) {
  const url = new URL("/settings/integrations", process.env.NEXTAUTH_URL);
  url.searchParams.set("jira", status);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return redirectTo("error", "Missing code or state from Jira");

  const verified = verifyJiraState(state);
  if (!verified) return redirectTo("error", "This Jira connection link expired — try again");

  try {
    const tokens = await exchangeJiraCode(code);
    const site = await getJiraSite(tokens.accessToken);

    await db
      .insert(issueTrackerIntegrations)
      .values({
        workspaceId: verified.workspaceId,
        provider: "jira",
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        siteUrl: site.url,
        siteName: site.name,
        connectedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [issueTrackerIntegrations.workspaceId, issueTrackerIntegrations.provider],
        set: {
          accessToken: encrypt(tokens.accessToken),
          refreshToken: encrypt(tokens.refreshToken),
          siteUrl: site.url,
          siteName: site.name,
          connectedBy: session.user.id,
        },
      });

    return redirectTo("connected");
  } catch (error) {
    console.error("Jira OAuth callback failed", error);
    return redirectTo("error", "Failed to connect Jira");
  }
}
