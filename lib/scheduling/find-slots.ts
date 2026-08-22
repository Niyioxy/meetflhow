import { fromZonedTime } from "date-fns-tz";
import { getBusyBlocks as getGoogleBusyBlocks } from "@/lib/google/calendar";
import { getBusyBlocks as getMicrosoftBusyBlocks } from "@/lib/microsoft/calendar";
import type { FreeBusyBlock } from "@/lib/google/calendar";

const WORKING_HOUR_START = 9;
const WORKING_HOUR_END = 17;
const SLOT_STEP_MINUTES = 30;
const MIN_LEAD_MINUTES = 120;
const MAX_BUSINESS_DAYS = 10;
// Safety bound on calendar days scanned while looking for MAX_BUSINESS_DAYS
// weekdays, in case something is ever wrong with the weekend check.
const MAX_DAYS_SCANNED = MAX_BUSINESS_DAYS * 3;

export interface FindSlotsInput {
  userId: string;
  provider: "google" | "microsoft";
  durationMinutes: number;
  businessDays: number;
  organizerTimezone: string;
  slotCount?: number;
}

interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number;
}

// Reads the calendar date in `timeZone` via the IANA tz database (Intl),
// independent of the host process's own system timezone.
function getZonedCalendarDate(date: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function isWeekendUtc({ year, month, day }: CalendarDate): boolean {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

function nextCalendarDate({ year, month, day }: CalendarDate): CalendarDate {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function zonedTimeToUtc(date: CalendarDate, hour: number, timeZone: string): Date {
  return fromZonedTime(new Date(Date.UTC(date.year, date.month - 1, date.day, hour, 0, 0)), timeZone);
}

function overlapsAny(start: Date, end: Date, blocks: FreeBusyBlock[]): boolean {
  return blocks.some((b) => start < b.end && end > b.start);
}

/**
 * Best-effort: returns null if the provider's free/busy lookup itself
 * failed (invalid token, API error) — distinct from an empty array, which
 * means the lookup succeeded but no open slots were found in range.
 */
export async function findOpenSlots(input: FindSlotsInput): Promise<Date[] | null> {
  const { userId, provider, durationMinutes, organizerTimezone, slotCount = 3 } = input;
  const businessDays = Math.min(Math.max(Math.trunc(input.businessDays), 1), MAX_BUSINESS_DAYS);

  const now = new Date();
  const earliestStart = new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000);

  const candidateDays: CalendarDate[] = [];
  let cursor = getZonedCalendarDate(now, organizerTimezone);
  for (let scanned = 0; candidateDays.length < businessDays && scanned < MAX_DAYS_SCANNED; scanned++) {
    if (!isWeekendUtc(cursor)) candidateDays.push(cursor);
    cursor = nextCalendarDate(cursor);
  }
  if (candidateDays.length === 0) return [];

  const timeMin = zonedTimeToUtc(candidateDays[0], WORKING_HOUR_START, organizerTimezone);
  const timeMax = zonedTimeToUtc(candidateDays[candidateDays.length - 1], WORKING_HOUR_END, organizerTimezone);

  const busyBlocks =
    provider === "google"
      ? await getGoogleBusyBlocks(userId, timeMin, timeMax)
      : await getMicrosoftBusyBlocks(userId, timeMin, timeMax);
  if (busyBlocks === null) return null;

  const slots: Date[] = [];
  for (const day of candidateDays) {
    const dayStart = zonedTimeToUtc(day, WORKING_HOUR_START, organizerTimezone);
    const dayEnd = zonedTimeToUtc(day, WORKING_HOUR_END, organizerTimezone);

    for (
      let slotStart = dayStart;
      slotStart.getTime() + durationMinutes * 60_000 <= dayEnd.getTime();
      slotStart = new Date(slotStart.getTime() + SLOT_STEP_MINUTES * 60_000)
    ) {
      if (slotStart < earliestStart) continue;
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
      if (!overlapsAny(slotStart, slotEnd, busyBlocks)) {
        slots.push(slotStart);
        if (slots.length >= slotCount) return slots;
      }
    }
  }

  return slots;
}
