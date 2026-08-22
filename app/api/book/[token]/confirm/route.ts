import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmBookingSlot, bookingErrorResponse } from "@/lib/scheduling/booking-requests";

const bodySchema = z.object({
  selectedSlot: z.string().datetime(),
});

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const confirmed = await confirmBookingSlot(params.token, parsed.data.selectedSlot);
    return NextResponse.json({ confirmed });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
