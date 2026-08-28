import Stripe from "stripe";

// Built lazily (not at module load) so importing this file doesn't require
// the key to be set — only actually using the client does. Matches the
// pattern in lib/deepgram/live-token.ts.
let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}
