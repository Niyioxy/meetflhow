import { NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/internal-auth";
import { dispatchEffects } from "@/lib/processing/dispatch";

export const maxDuration = 60;

/**
 * Sweeper for the delivery ledger: retries failed deliveries (with backoff,
 * up to the attempt cap) and sends anything a crashed worker left queued —
 * e.g. a meeting that committed "ready" but died before notifying.
 */
export async function GET(req: Request) {
  const denied = checkCronSecret(req);
  if (denied) return denied;

  const result = await dispatchEffects({}, 50);
  return NextResponse.json(result);
}
