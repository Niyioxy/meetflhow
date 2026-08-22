import { NextResponse } from "next/server";
import { getBookingRequestPreview, bookingErrorResponse } from "@/lib/scheduling/booking-requests";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const preview = await getBookingRequestPreview(params.token);
    return NextResponse.json({ bookingRequest: preview });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
