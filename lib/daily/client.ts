/**
 * Daily.co REST API helpers (audio-only calling — see components/call/call-room.tsx
 * for the client-side daily-js usage).
 *
 * Setup: create an account at https://dashboard.daily.co, grab the API key
 * from Developers > API keys. Register a webhook at
 * https://dashboard.daily.co/webhooks pointing to
 * `${NEXTAUTH_URL}/api/webhooks/daily`, subscribed to the
 * "recording.ready-to-download" event, and copy its HMAC secret.
 * Required env vars:
 *   DAILY_API_KEY
 *   DAILY_DOMAIN (the *.daily.co subdomain shown in the dashboard)
 *   DAILY_WEBHOOK_SECRET
 */
const API_BASE = "https://api.daily.co/v1";

function getApiKey(): string {
  const key = process.env.DAILY_API_KEY;
  if (!key) {
    throw new Error("DAILY_API_KEY is not set");
  }
  return key;
}

async function dailyFetch(path: string, init: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Daily API error (${res.status}): ${await res.text().catch(() => "")}`);
  }
  return res.json();
}

export interface DailyRoom {
  name: string;
  url: string;
}

/**
 * Creates a private, audio-only room. Defaults to expiring in a few hours if
 * never joined; pass `expiresAt` (epoch seconds) for rooms tied to a meeting
 * scheduled further out, so the room stays valid until then.
 */
export async function createRoom(roomName: string, expiresAt?: number): Promise<DailyRoom> {
  const exp = expiresAt ?? Math.floor(Date.now() / 1000) + 6 * 60 * 60;
  return dailyFetch("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: roomName,
      privacy: "private",
      properties: {
        enable_recording: "cloud-audio-only",
        exp,
        eject_at_room_exp: true,
        enable_prejoin_ui: false,
        start_video_off: true,
      },
    }),
  });
}

export async function deleteRoom(roomName: string): Promise<void> {
  await fetch(`${API_BASE}/rooms/${roomName}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getApiKey()}` },
  });
}

/** Mints a short-lived token authorizing one user to join one room. Also triggers auto-recording. */
export async function createMeetingToken(params: {
  roomName: string;
  userName: string;
  isOwner: boolean;
}): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + 4 * 60 * 60;
  const data = await dailyFetch("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: params.roomName,
        user_name: params.userName,
        is_owner: params.isOwner,
        exp: expiresAt,
        start_cloud_recording: true,
      },
    }),
  });
  return data.token;
}
