import { NextResponse } from "next/server";

/** Guards a non-session, self-triggered route (e.g. background processing steps). */
export function checkInternalSecret(req: Request): NextResponse | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_SECRET}`) {
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
