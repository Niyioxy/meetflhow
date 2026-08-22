/**
 * Microsoft Teams calendar helpers (personal, per-user — mirrors lib/google/calendar.ts).
 *
 * Setup: register an app at https://entra.microsoft.com (App registrations >
 * New registration).
 *   - Supported account types: "Accounts in any organizational directory and
 *     personal Microsoft accounts" (multi-tenant + personal), to match the
 *     unconfigured `common` issuer this provider uses by default.
 *   - Redirect URI (platform: Web): `${NEXTAUTH_URL}/api/auth/callback/microsoft-entra-id`
 *   - API permissions (Microsoft Graph, Delegated): Calendars.ReadWrite,
 *     OnlineMeetings.ReadWrite, offline_access, User.Read. Grant admin
 *     consent if your tenant requires it for these scopes.
 *   - Certificates & secrets: create a client secret (not a certificate) for
 *     MICROSOFT_CLIENT_SECRET.
 * Required env vars:
 *   MICROSOFT_CLIENT_ID
 *   MICROSOFT_CLIENT_SECRET
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";

const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPE =
  "openid profile email User.Read Calendars.ReadWrite OnlineMeetings.ReadWrite offline_access";

async function getMicrosoftAccount(userId: string) {
  return db.query.accounts.findFirst({
    where: (a, { eq, and }) =>
      and(eq(a.userId, userId), eq(a.provider, "microsoft-entra-id")),
  });
}

export async function isTeamsConnected(userId: string) {
  const account = await getMicrosoftAccount(userId);
  return Boolean(account?.refresh_token && account.scope?.includes("Calendars.ReadWrite"));
}

/** Returns a valid access token for the user's Microsoft account, refreshing it if needed. Returns null if not connected. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const account = await getMicrosoftAccount(userId);
  if (!account?.refresh_token || !account.scope?.includes("Calendars.ReadWrite")) {
    return null;
  }

  const bufferSeconds = 60;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (account.access_token && account.expires_at && account.expires_at - bufferSeconds > nowSeconds) {
    return account.access_token;
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
      scope: SCOPE,
    }),
  });

  if (!res.ok) {
    console.error("Failed to refresh Microsoft access token", await res.text().catch(() => ""));
    return null;
  }

  const credentials = await res.json();
  if (!credentials.access_token) return null;

  await db
    .update(accounts)
    .set({
      access_token: credentials.access_token,
      // Microsoft can rotate the refresh token on refresh; persist it if a new one came back.
      refresh_token: credentials.refresh_token ?? undefined,
      expires_at: credentials.expires_in
        ? Math.floor(Date.now() / 1000) + credentials.expires_in
        : undefined,
    })
    .where(
      and(
        eq(accounts.provider, "microsoft-entra-id"),
        eq(accounts.providerAccountId, account.providerAccountId)
      )
    );

  return credentials.access_token;
}

export interface TeamsMeetingInput {
  userId: string;
  title: string;
  notes?: string | null;
  startTime: Date;
  durationMinutes: number;
  attendees: string[];
}

export interface TeamsMeetingResult {
  microsoftEventId: string;
  meetLink: string | null;
}

function toGraphDateTime(date: Date) {
  return { dateTime: date.toISOString().replace("Z", ""), timeZone: "UTC" };
}

/** Best-effort: returns null if the user hasn't connected Microsoft Teams or the API call fails. */
export async function createTeamsMeeting(
  input: TeamsMeetingInput
): Promise<TeamsMeetingResult | null> {
  const accessToken = await getValidAccessToken(input.userId);
  if (!accessToken) return null;

  const endTime = new Date(input.startTime.getTime() + input.durationMinutes * 60_000);

  try {
    const res = await fetch(`${GRAPH_BASE}/me/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: input.title,
        body: { contentType: "text", content: input.notes ?? "" },
        start: toGraphDateTime(input.startTime),
        end: toGraphDateTime(endTime),
        attendees: input.attendees.map((email) => ({
          emailAddress: { address: email },
          type: "required",
        })),
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
      }),
    });

    if (!res.ok) {
      console.error("Failed to create Microsoft Teams meeting", await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    return {
      microsoftEventId: data.id,
      meetLink: data.onlineMeeting?.joinUrl ?? null,
    };
  } catch (error) {
    console.error("Failed to create Microsoft Teams meeting", error);
    return null;
  }
}

export async function updateTeamsMeeting(
  userId: string,
  microsoftEventId: string,
  input: Omit<TeamsMeetingInput, "userId">
): Promise<void> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return;

  const endTime = new Date(input.startTime.getTime() + input.durationMinutes * 60_000);

  try {
    const res = await fetch(`${GRAPH_BASE}/me/events/${microsoftEventId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: input.title,
        body: { contentType: "text", content: input.notes ?? "" },
        start: toGraphDateTime(input.startTime),
        end: toGraphDateTime(endTime),
        attendees: input.attendees.map((email) => ({
          emailAddress: { address: email },
          type: "required",
        })),
      }),
    });
    if (!res.ok) {
      console.error("Failed to update Microsoft Teams meeting", await res.text().catch(() => ""));
    }
  } catch (error) {
    console.error("Failed to update Microsoft Teams meeting", error);
  }
}

export async function deleteTeamsMeeting(userId: string, microsoftEventId: string): Promise<void> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return;

  try {
    const res = await fetch(`${GRAPH_BASE}/me/events/${microsoftEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok && res.status !== 404) {
      console.error("Failed to delete Microsoft Teams meeting", await res.text().catch(() => ""));
    }
  } catch (error) {
    console.error("Failed to delete Microsoft Teams meeting", error);
  }
}

export interface FreeBusyBlock {
  start: Date;
  end: Date;
}

/** Best-effort: returns null if the user hasn't connected Microsoft Teams or the API call fails. */
export async function getBusyBlocks(
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<FreeBusyBlock[] | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  const params = new URLSearchParams({
    startDateTime: toGraphDateTime(timeMin).dateTime,
    endDateTime: toGraphDateTime(timeMax).dateTime,
    $select: "start,end,showAs",
    $top: "100",
  });

  try {
    const res = await fetch(`${GRAPH_BASE}/me/calendarView?${params}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });

    if (!res.ok) {
      console.error("Failed to fetch Microsoft Calendar free/busy", await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const events: { start: { dateTime: string }; end: { dateTime: string }; showAs?: string }[] =
      data.value ?? [];

    return events
      .filter((e) => e.showAs !== "free")
      .map((e) => ({
        start: new Date(`${e.start.dateTime}Z`),
        end: new Date(`${e.end.dateTime}Z`),
      }));
  } catch (error) {
    console.error("Failed to fetch Microsoft Calendar free/busy", error);
    return null;
  }
}
