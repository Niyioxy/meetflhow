import { DeepgramClient } from "@deepgram/sdk";

// Separate, narrower-scoped client (Member role, keys:write) used only to mint
// short-lived browser tokens — kept apart from the main transcription key so a
// leaked live-caption token can't be used to create further API keys. Built
// lazily (not at module load) so importing this file doesn't require the key
// to be set — only actually minting a token does.
let deepgramManagement: DeepgramClient | null = null;

function getManagementClient(): DeepgramClient {
  if (!process.env.DEEPGRAM_MANAGEMENT_API_KEY) {
    throw new Error("DEEPGRAM_MANAGEMENT_API_KEY is not set");
  }
  if (!deepgramManagement) {
    deepgramManagement = new DeepgramClient({
      apiKey: process.env.DEEPGRAM_MANAGEMENT_API_KEY,
    });
  }
  return deepgramManagement;
}

let cachedProjectId: string | null = null;

async function getProjectId(): Promise<string> {
  if (cachedProjectId) return cachedProjectId;

  const response = await getManagementClient().manage.v1.projects.list();
  const projectId = response.projects?.[0]?.project_id;
  if (!projectId) {
    throw new Error("No Deepgram project found for this API key");
  }

  cachedProjectId = projectId;
  return projectId;
}

const LIVE_TOKEN_TTL_SECONDS = 3600;

export async function createLiveCaptionToken(): Promise<{
  key: string;
  expiresAt: string | null;
}> {
  const projectId = await getProjectId();

  const response = await getManagementClient().manage.v1.projects.keys.create(projectId, {
    comment: "MeetFlhow live caption token (short-lived, browser-scoped)",
    scopes: ["usage:write"],
    time_to_live_in_seconds: LIVE_TOKEN_TTL_SECONDS,
  });

  if (!response.key) {
    throw new Error("Deepgram did not return a key");
  }

  return { key: response.key, expiresAt: response.expiration_date ?? null };
}
