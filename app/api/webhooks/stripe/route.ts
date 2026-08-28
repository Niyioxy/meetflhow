import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { getStripeClient } from "@/lib/stripe/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  // Must be the raw body — constructEvent verifies the signature against
  // the exact bytes Stripe sent, so req.json() (which reserializes) would
  // always fail verification.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspaceId;
        if (workspaceId && session.customer && session.subscription) {
          await db
            .update(workspaces)
            .set({
              plan: "team",
              stripeCustomerId: String(session.customer),
              stripeSubscriptionId: String(session.subscription),
              subscriptionStatus: "active",
            })
            .where(eq(workspaces.id, workspaceId));
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = String(subscription.customer);
        const status = subscription.status;
        const keepsTeamAccess = status === "active" || status === "past_due";
        await db
          .update(workspaces)
          .set({
            plan: keepsTeamAccess ? "team" : "free",
            subscriptionStatus: status === "active" ? "active" : status === "past_due" ? "past_due" : "canceled",
          })
          .where(eq(workspaces.stripeCustomerId, customerId));
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = String(subscription.customer);
        await db
          .update(workspaces)
          .set({ plan: "free", subscriptionStatus: "canceled" })
          .where(eq(workspaces.stripeCustomerId, customerId));
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to process Stripe webhook", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
