import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceMember, getWorkspaceOrThrow, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { getStripeClient } from "@/lib/stripe/client";
import { z } from "zod";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { workspaceId } = parsed.data;

  let workspace;
  try {
    const member = await getWorkspaceMember(session.user.id, workspaceId);
    requireRole(member, "owner");
    workspace = await getWorkspaceOrThrow(workspaceId);
  } catch (error) {
    return workspaceErrorResponse(error);
  }

  if (!workspace.stripeCustomerId) {
    return NextResponse.json({ error: "This workspace has no billing account yet" }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/settings/workspace`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("Failed to create Stripe billing portal session", error);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
