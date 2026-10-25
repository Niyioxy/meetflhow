import { createPolar } from "@polar-sh/sdk/2026-10";

type PolarClient = ReturnType<typeof createPolar>;

// Built lazily (not at module load) so importing this file doesn't require
// the token to be set — only actually using the client does. Matches the
// pattern in lib/deepgram/live-token.ts.
let polarClient: PolarClient | null = null;

export function getPolarClient(): PolarClient {
  // Trimmed: a stray newline or space from pasting the secret turns a valid
  // token into a 401 that looks like a revoked one.
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN is not set");
  }
  if (!polarClient) {
    polarClient = createPolar({
      accessToken,
      // Sandbox and production use separate tokens, products and webhooks.
      environment: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
    });
  }
  return polarClient;
}
