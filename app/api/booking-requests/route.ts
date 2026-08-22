import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createBookingRequest, bookingErrorResponse } from "@/lib/scheduling/booking-requests";

const bodySchema = z.object({
  title: z.string().min(1),
  inviteeEmail: z.string().email(),
  durationMinutes: z.number().int().min(5).max(480),
  businessDays: z.number().int().min(1).max(10),
  organizerTimezone: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await createBookingRequest(session.user.id, parsed.data);
    return NextResponse.json({ bookingRequest: result }, { status: 201 });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
