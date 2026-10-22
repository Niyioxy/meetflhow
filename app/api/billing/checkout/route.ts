import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getWorkspaceMember, getWorkspaceOrThrow, requireRole, workspaceErrorResponse } from "@/lib/workspace-auth";
import { getPolarClient } from "@/lib/polar/client";
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

  if (workspace.plan === "team" && workspace.subscriptionStatus === "active") {
    return NextResponse.json({ error: "This workspace is already on the Team plan" }, { status: 409 });
  }

  const productId = process.env.POLAR_PRODUCT_ID_TEAM_MONTHLY;
  if (!productId || !process.env.POLAR_ACCESS_TOKEN) {
    return NextResponse.json({ error: "Billing is not configured on this server yet" }, { status: 503 });
  }

  try {
    // The workspace ID is the customer's external ID, so Polar links every
    // order/subscription to the workspace and the webhook can find it again
    // without us having to store a customer ID first.
    const checkout = await getPolarClient().checkouts.create({
      products: [productId],
      external_customer_id: workspaceId,
      customer_email: session.user.email ?? undefined,
      customer_name: workspace.name,
      metadata: { workspaceId },
      success_url: `${process.env.NEXTAUTH_URL}/settings/workspace?billing=success`,
      return_url: `${process.env.NEXTAUTH_URL}/settings/workspace?billing=cancelled`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Failed to create Polar checkout", error);
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
