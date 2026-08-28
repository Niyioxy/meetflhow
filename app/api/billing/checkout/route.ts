import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
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

  const priceId = process.env.STRIPE_PRICE_ID_TEAM_MONTHLY;
  if (!priceId) {
    return NextResponse.json({ error: "Billing is not configured on this server yet" }, { status: 503 });
  }

  try {
    const stripe = getStripeClient();

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email ?? undefined,
        name: workspace.name,
        metadata: { workspaceId },
      });
      customerId = customer.id;
      await db.update(workspaces).set({ stripeCustomerId: customerId }).where(eq(workspaces.id, workspaceId));
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXTAUTH_URL}/settings/workspace?billing=success`,
      cancel_url: `${process.env.NEXTAUTH_URL}/settings/workspace?billing=cancelled`,
      metadata: { workspaceId },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Failed to create Stripe checkout session", error);
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}
