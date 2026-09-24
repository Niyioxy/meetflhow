import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";

/**
 * Constant-time check of an `Authorization: Bearer <secret>` header. Fails
 * closed: if the expected secret is unset or empty, every request is rejected
 * (otherwise `Bearer undefined` would match a missing env var).
 */
export function hasBearerSecret(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  // Hash both sides so timingSafeEqual gets equal-length buffers.
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

/** Guards a non-session, self-triggered route (e.g. background processing steps). */
export function checkInternalSecret(req: Request): NextResponse | null {
  if (!process.env.INTERNAL_API_SECRET) {
    console.error("INTERNAL_API_SECRET is not set; rejecting internal request");
  }
  if (!hasBearerSecret(req, process.env.INTERNAL_API_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Guards a cron route invoked by Vercel Cron with `CRON_SECRET`. */
export function checkCronSecret(req: Request): NextResponse | null {
  if (!process.env.CRON_SECRET) {
    console.error("CRON_SECRET is not set; rejecting cron request");
  }
  if (!hasBearerSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * Hands off to the next step of this app's own internal processing pipeline.
 * The receiving route is expected to ack near-instantly and continue its own
 * work via `waitUntil` — so awaiting this call only costs that ack's latency,
 * not the next step's full processing time. Throws if the hand-off itself
 * fails (e.g. a misconfigured secret), so the caller can mark the meeting
 * failed instead of leaving it stuck "processing" forever.
 */
export async function triggerInternalStep(path: string, body: unknown): Promise<void> {
  if (!process.env.INTERNAL_API_SECRET) {
    throw new Error("INTERNAL_API_SECRET is not set; cannot hand off internal step");
  }
  const res = await fetch(`${process.env.NEXTAUTH_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Internal step ${path} rejected the hand-off with status ${res.status}`);
  }
}
