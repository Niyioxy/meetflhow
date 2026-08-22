import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { bookingRequests, scheduledMeetings } from "@/db/schema";
import type { ScheduledMeetingPlatform } from "@/db/schema";
import { isCalendarConnected, createCalendarEvent } from "@/lib/google/calendar";
import { isTeamsConnected, createTeamsMeeting } from "@/lib/microsoft/calendar";
import { findOpenSlots } from "@/lib/scheduling/find-slots";
import { getEmailClient } from "@/lib/email/client";
import { BookingPickTimeEmail } from "@/lib/emails/booking-pick-time";
import { BookingConfirmedEmail } from "@/lib/emails/booking-confirmed";
import { SITE_URL } from "@/lib/site";

export class BookingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function bookingErrorResponse(error: unknown) {
  if (error instanceof BookingError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Unexpected booking error", error);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export interface CreateBookingRequestInput {
  title: string;
  durationMinutes: number;
  inviteeEmail: string;
  businessDays: number;
  organizerTimezone: string;
}

export async function createBookingRequest(userId: string, input: CreateBookingRequestInput) {
  const [googleConnected, teamsConnected] = await Promise.all([
    isCalendarConnected(userId),
    isTeamsConnected(userId),
  ]);

  if (!googleConnected && !teamsConnected) {
    throw new BookingError(
      "Connect Google Calendar or Microsoft Teams in Settings before booking with an agent.",
      400
    );
  }

  const provider: "google" | "microsoft" = googleConnected ? "google" : "microsoft";
  const platform: ScheduledMeetingPlatform = provider === "google" ? "Google Meet" : "Microsoft Teams";

  const slots = await findOpenSlots({
    userId,
    provider,
    durationMinutes: input.durationMinutes,
    businessDays: input.businessDays,
    organizerTimezone: input.organizerTimezone,
  });

  if (slots === null) {
    throw new BookingError("Couldn't check your calendar availability. Try again.", 502);
  }
  if (slots.length === 0) {
    throw new BookingError("No open slots found in that range. Try a longer date range.", 422);
  }

  const organizer = await db.query.users.findFirst({ where: (u, { eq }) => eq(u.id, userId) });
  if (!organizer) throw new BookingError("User not found", 404);

  const lastSlotEnd = new Date(slots[slots.length - 1].getTime() + input.durationMinutes * 60_000);

  const [request] = await db
    .insert(bookingRequests)
    .values({
      userId,
      title: input.title,
      durationMinutes: input.durationMinutes,
      inviteeEmail: input.inviteeEmail.toLowerCase(),
      platform,
      proposedSlots: slots.map((s) => s.toISOString()),
      organizerTimezone: input.organizerTimezone,
      token: randomUUID(),
      expiresAt: new Date(lastSlotEnd.getTime() + 60 * 60_000),
    })
    .returning();

  const bookingUrl = `${SITE_URL}/book/${request.token}`;
  try {
    await getEmailClient().emails.send({
      from: process.env.EMAIL_FROM || "MeetFlhow <reminders@meetflow.app>",
      to: [input.inviteeEmail],
      subject: `${organizer.name ?? "Someone"} wants to schedule "${input.title}" with you`,
      react: BookingPickTimeEmail({
        organizerName: organizer.name ?? "A MeetFlhow user",
        title: input.title,
        durationMinutes: input.durationMinutes,
        bookingUrl,
      }),
    });
  } catch (error) {
    console.error("Failed to send booking-pick-time email", error);
  }

  return { id: request.id, token: request.token };
}

export interface BookingRequestPreview {
  title: string;
  organizerName: string;
  durationMinutes: number;
  proposedSlots: string[];
  platform: ScheduledMeetingPlatform;
  expired: boolean;
  alreadyBooked: boolean;
}

export async function getBookingRequestPreview(token: string): Promise<BookingRequestPreview> {
  const request = await db.query.bookingRequests.findFirst({
    where: (r, { eq }) => eq(r.token, token),
    with: { user: true },
  });
  if (!request) throw new BookingError("Booking link not found", 404);

  return {
    title: request.title,
    organizerName: request.user.name ?? "A MeetFlhow user",
    durationMinutes: request.durationMinutes,
    proposedSlots: request.proposedSlots,
    platform: request.platform,
    expired: !request.respondedAt && request.expiresAt.getTime() < Date.now(),
    alreadyBooked: Boolean(request.respondedAt),
  };
}

export interface ConfirmedBooking {
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  meetLink: string | null;
  platform: ScheduledMeetingPlatform;
}

export async function confirmBookingSlot(token: string, selectedSlotIso: string): Promise<ConfirmedBooking> {
  const request = await db.query.bookingRequests.findFirst({
    where: (r, { eq }) => eq(r.token, token),
    with: { user: true },
  });
  if (!request) throw new BookingError("Booking link not found", 404);
  if (request.respondedAt) throw new BookingError("This time has already been booked.", 409);
  if (request.expiresAt.getTime() < Date.now()) {
    throw new BookingError("This booking link has expired.", 410);
  }
  if (!request.proposedSlots.includes(selectedSlotIso)) {
    throw new BookingError("That time is no longer available.", 400);
  }

  const startTime = new Date(selectedSlotIso);

  let meetLink: string | null = null;
  let googleEventId: string | null = null;
  let microsoftEventId: string | null = null;

  if (request.platform === "Google Meet") {
    const result = await createCalendarEvent({
      userId: request.userId,
      title: request.title,
      notes: null,
      startTime,
      durationMinutes: request.durationMinutes,
      attendees: [request.inviteeEmail],
      wantMeetLink: true,
    });
    if (result) {
      meetLink = result.meetLink;
      googleEventId = result.googleEventId;
    }
  } else if (request.platform === "Microsoft Teams") {
    const result = await createTeamsMeeting({
      userId: request.userId,
      title: request.title,
      notes: null,
      startTime,
      durationMinutes: request.durationMinutes,
      attendees: [request.inviteeEmail],
    });
    if (result) {
      meetLink = result.meetLink;
      microsoftEventId = result.microsoftEventId;
    }
  }

  const [scheduledMeeting] = await db
    .insert(scheduledMeetings)
    .values({
      userId: request.userId,
      title: request.title,
      platform: request.platform,
      scheduledAt: startTime,
      durationMinutes: request.durationMinutes,
      attendees: [request.inviteeEmail],
      meetLink,
      googleEventId,
      microsoftEventId,
    })
    .returning();

  // Guard against a double-submit race: only the first confirm wins.
  const [updated] = await db
    .update(bookingRequests)
    .set({ respondedAt: new Date(), selectedSlot: startTime, scheduledMeetingId: scheduledMeeting.id })
    .where(and(eq(bookingRequests.id, request.id), isNull(bookingRequests.respondedAt)))
    .returning();

  if (!updated) {
    throw new BookingError("This time has already been booked.", 409);
  }

  const timeLabel = `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: request.organizerTimezone,
  }).format(startTime)} (${request.organizerTimezone})`;

  for (const to of [request.user.email, request.inviteeEmail]) {
    try {
      await getEmailClient().emails.send({
        from: process.env.EMAIL_FROM || "MeetFlhow <reminders@meetflow.app>",
        to: [to],
        subject: `Confirmed: "${request.title}"`,
        react: BookingConfirmedEmail({
          title: request.title,
          timeLabel,
          platform: request.platform,
          meetLink,
        }),
      });
    } catch (error) {
      console.error("Failed to send booking-confirmed email", error);
    }
  }

  return {
    title: request.title,
    scheduledAt: startTime.toISOString(),
    durationMinutes: request.durationMinutes,
    meetLink,
    platform: request.platform,
  };
}
