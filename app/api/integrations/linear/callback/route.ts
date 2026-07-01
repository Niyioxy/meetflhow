import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { issueTrackerIntegrations } from "@/db/schema";
import { exchangeLinearCode, verifyLinearState } from "@/lib/integrations/linear";
import { encrypt } from "@/lib/crypto";

function redirectTo(status: "connected" | "error", message?: string) {
  const url = new URL("/settings/integrations", process.env.NEXTAUTH_URL);
  url.searchParams.set("linear", status);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return redirectTo("error", "Missing code or state from Linear");

  const verified = verifyLinearState(state);
  if (!verified) return redirectTo("error", "This Linear connection link expired — try again");

  try {
    const { accessToken } = await exchangeLinearCode(code);

    await db
      .insert(issueTrackerIntegrations)
      .values({
        workspaceId: verified.workspaceId,
        provider: "linear",
        accessToken: encrypt(accessToken),
        connectedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [issueTrackerIntegrations.workspaceId, issueTrackerIntegrations.provider],
        set: {
          accessToken: encrypt(accessToken),
          connectedBy: session.user.id,
        },
      });

    return redirectTo("connected");
  } catch (error) {
    console.error("Linear OAuth callback failed", error);
    return redirectTo("error", "Failed to connect Linear");
  }
}
