import { NextResponse } from "next/server";
import { webhooks } from "@polar-sh/sdk/2026-10";
import { applyPolarSubscription, type PolarSubscriptionPayload } from "@/lib/polar/subscription";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  // Must be the raw body — the signature is checked against the exact bytes
  // Polar sent, so req.json() (which reserializes) would always fail.
  const rawBody = await req.text();

  let event;
  try {
    event = await webhooks.validateEvent(
      rawBody,
      {
        "webhook-id": req.headers.get("webhook-id") ?? "",
        "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
        "webhook-signature": req.headers.get("webhook-signature") ?? "",
      },
      webhookSecret,
    );
  } catch (error) {
    if (error instanceof webhooks.PolarWebhookVerificationError) {
      console.error("Polar webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    if (error instanceof webhooks.PolarWebhookError) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    throw error;
  }

  try {
    // subscription.created/active/updated/canceled/uncanceled/past_due/revoked
    // all carry the full subscription, so one handler covers them.
    if (event.type.startsWith("subscription.")) {
      await applyPolarSubscription(event.data as unknown as PolarSubscriptionPayload);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 makes Polar retry the delivery.
    console.error("Failed to process Polar webhook", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
