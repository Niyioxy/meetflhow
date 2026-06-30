import crypto from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

/** Signs `provider:workspaceId:timestamp` with NEXTAUTH_SECRET so an OAuth callback can verify it without a cookie. */
export function signOAuthState(provider: string, workspaceId: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set");
  const payload = `${provider}:${workspaceId}:${Date.now()}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyOAuthState(provider: string, state: string): { workspaceId: string } | null {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [stateProvider, workspaceId, timestamp, sig] = decoded.split(":");
    if (!stateProvider || !workspaceId || !timestamp || !sig || stateProvider !== provider) return null;

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${stateProvider}:${workspaceId}:${timestamp}`)
      .digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    if (Date.now() - Number(timestamp) > STATE_TTL_MS) return null;

    return { workspaceId };
  } catch {
    return null;
  }
}
