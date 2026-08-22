import { getBookingRequestPreview } from "@/lib/scheduling/booking-requests";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { PickTime } from "@/components/booking/pick-time";

// Deliberately no auth() check — the invitee is not a MeetFlhow user and
// never logs in, unlike app/invite/[token]/page.tsx's workspace-invite flow.
export default async function BookPage({ params }: { params: { token: string } }) {
  let booking;
  try {
    booking = await getBookingRequestPreview(params.token);
  } catch {
    booking = null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo size="lg" className="mx-auto mb-2" />
          {booking ? (
            <CardDescription>
              {booking.organizerName} wants to schedule{" "}
              <strong className="text-foreground">&ldquo;{booking.title}&rdquo;</strong> with you
              ({booking.durationMinutes} min, via {booking.platform}).
            </CardDescription>
          ) : (
            <CardDescription>This booking link is invalid.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {booking?.alreadyBooked ? (
            <p className="text-center text-sm text-muted-foreground">
              This time has already been booked.
            </p>
          ) : booking?.expired ? (
            <p className="text-center text-sm text-muted-foreground">
              This booking link has expired.
            </p>
          ) : booking ? (
            <PickTime token={params.token} proposedSlots={booking.proposedSlots} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = { title: "Pick a time — MeetFlhow" };
