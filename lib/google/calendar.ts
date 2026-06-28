import { google } from "googleapis";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
}

async function getGoogleAccount(userId: string) {
  return db.query.accounts.findFirst({
    where: (a, { eq, and }) =>
      and(eq(a.userId, userId), eq(a.provider, "google")),
  });
}

export async function isCalendarConnected(userId: string) {
  const account = await getGoogleAccount(userId);
  return Boolean(account?.refresh_token && account.scope?.includes("calendar"));
}

/** Returns a valid access token for the user's Google account, refreshing it if needed. Returns null if not connected. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const account = await getGoogleAccount(userId);
  if (!account?.refresh_token || !account.scope?.includes("calendar")) {
    return null;
  }

  const bufferSeconds = 60;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (account.access_token && account.expires_at && account.expires_at - bufferSeconds > nowSeconds) {
    return account.access_token;
  }

  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: account.refresh_token });

  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    return null;
  }

  await db
    .update(accounts)
    .set({
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date
        ? Math.floor(credentials.expiry_date / 1000)
        : undefined,
    })
    .where(
      and(eq(accounts.provider, "google"), eq(accounts.providerAccountId, account.providerAccountId))
    );

  return credentials.access_token;
}

async function getCalendarClient(userId: string) {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  const client = getOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: client });
}

export interface CalendarEventInput {
  userId: string;
  title: string;
  notes?: string | null;
  startTime: Date;
  durationMinutes: number;
  attendees: string[];
  wantMeetLink: boolean;
}

export interface CalendarEventResult {
  googleEventId: string;
  meetLink: string | null;
}

/** Best-effort: returns null if the user hasn't connected Google Calendar or the API call fails. */
export async function createCalendarEvent(
  input: CalendarEventInput
): Promise<CalendarEventResult | null> {
  const calendar = await getCalendarClient(input.userId);
  if (!calendar) return null;

  const endTime = new Date(input.startTime.getTime() + input.durationMinutes * 60_000);

  try {
    const res = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: input.wantMeetLink ? 1 : 0,
      requestBody: {
        summary: input.title,
        description: input.notes ?? undefined,
        start: { dateTime: input.startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
        attendees: input.attendees.map((email) => ({ email })),
        conferenceData: input.wantMeetLink
          ? {
              createRequest: {
                requestId: `meetflhow-${Date.now()}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            }
          : undefined,
      },
    });

    return {
      googleEventId: res.data.id!,
      meetLink: res.data.hangoutLink ?? null,
    };
  } catch (error) {
    console.error("Failed to create Google Calendar event", error);
    return null;
  }
}

export async function updateCalendarEvent(
  userId: string,
  googleEventId: string,
  input: Omit<CalendarEventInput, "userId" | "wantMeetLink">
): Promise<void> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return;

  const endTime = new Date(input.startTime.getTime() + input.durationMinutes * 60_000);

  try {
    await calendar.events.patch({
      calendarId: "primary",
      eventId: googleEventId,
      requestBody: {
        summary: input.title,
        description: input.notes ?? undefined,
        start: { dateTime: input.startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
        attendees: input.attendees.map((email) => ({ email })),
      },
    });
  } catch (error) {
    console.error("Failed to update Google Calendar event", error);
  }
}

export async function deleteCalendarEvent(userId: string, googleEventId: string): Promise<void> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return;

  try {
    await calendar.events.delete({ calendarId: "primary", eventId: googleEventId });
  } catch (error) {
    console.error("Failed to delete Google Calendar event", error);
  }
}
