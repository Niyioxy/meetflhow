import { NextResponse } from "next/server";
import { db } from "@/db";
import { notionIntegrations } from "@/db/schema";
import { exchangeNotionCode, verifyState } from "@/lib/integrations/notion";
import { encrypt } from "@/lib/crypto";
import { auth } from "@/auth";

function redirectTo(status: "connected" | "error", message?: string) {
  const url = new URL("/settings/integrations", process.env.NEXTAUTH_URL);
  url.searchParams.set("notion", status);
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
    return redirectTo("error", "Missing code or state from Notion");
  }

  const verified = verifyState(state);
  if (!verified) {
    return redirectTo("error", "This Notion connection link expired — try again");
  }

  try {
    const result = await exchangeNotionCode(code);

    await db
      .insert(notionIntegrations)
      .values({
        workspaceId: verified.workspaceId,
        accessToken: encrypt(result.accessToken),
        notionWorkspaceName: result.workspaceName,
        notionWorkspaceIcon: result.workspaceIcon,
        connectedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: notionIntegrations.workspaceId,
        set: {
          accessToken: encrypt(result.accessToken),
          notionWorkspaceName: result.workspaceName,
          notionWorkspaceIcon: result.workspaceIcon,
          connectedBy: session.user.id,
        },
      });

    return redirectTo("connected");
  } catch (error) {
    console.error("Notion OAuth callback failed", error);
    return redirectTo("error", "Failed to connect Notion");
  }
}
