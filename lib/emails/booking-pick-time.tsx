import { Button, Heading, Text } from "@react-email/components";
import { EmailLayout, emailButtonStyle } from "@/lib/emails/layout";

export function BookingPickTimeEmail({
  organizerName,
  title,
  durationMinutes,
  bookingUrl,
}: {
  organizerName: string;
  title: string;
  durationMinutes: number;
  bookingUrl: string;
}) {
  return (
    <EmailLayout preview={`${organizerName} wants to schedule "${title}" with you`}>
      <Heading style={{ fontSize: "18px", margin: "0 0 12px" }}>
        Pick a time for &ldquo;{title}&rdquo;
      </Heading>
      <Text style={{ fontSize: "14px", color: "#334155", lineHeight: "22px" }}>
        {organizerName} wants to schedule a {durationMinutes}-minute meeting with you. Pick
        whichever of the proposed times works best — it'll be booked automatically.
      </Text>
      <Button href={bookingUrl} style={emailButtonStyle}>
        Choose a time
      </Button>
    </EmailLayout>
  );
}
