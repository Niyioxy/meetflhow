import { NextResponse } from "next/server";
import { db } from "@/db";
import { slackIntegrations, slackPostSettings } from "@/db/schema";
import { exchangeSlackCode, verifyState } from "@/lib/integrations/slack";
import { encrypt } from "@/lib/crypto";
import { auth } from "@/auth";

function redirectTo(status: "connected" | "error", message?: string) {
  const url = new URL("/settings/integrations", process.env.NEXTAUTH_URL);
  url.searchParams.set("slack", status);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return redirectTo("error", "Missing code or state from Slack");
  }

  const verified = verifyState(state);
  if (!verified) {
    return redirectTo("error", "This Slack connection link expired — try again");
  }

  try {
    const result = await exchangeSlackCode(code);

    await db
      .insert(slackIntegrations)
      .values({
        workspaceId: verified.workspaceId,
        slackTeamId: result.teamId,
        slackTeamName: result.teamName,
        accessToken: encrypt(result.accessToken),
        botUserId: result.botUserId,
        connectedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: slackIntegrations.workspaceId,
        set: {
          slackTeamId: result.teamId,
          slackTeamName: result.teamName,
          accessToken: encrypt(result.accessToken),
          botUserId: result.botUserId,
          connectedBy: session.user.id,
        },
      });

    await db
      .insert(slackPostSettings)
      .values({ workspaceId: verified.workspaceId })
      .onConflictDoNothing({ target: slackPostSettings.workspaceId });

    return redirectTo("connected");
  } catch (error) {
    console.error("Slack OAuth callback failed", error);
    return redirectTo("error", "Failed to connect Slack");
  }
}
