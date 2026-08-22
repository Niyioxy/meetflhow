import { Button, Heading, Text } from "@react-email/components";
import { EmailLayout, emailButtonStyle } from "@/lib/emails/layout";

export function BookingConfirmedEmail({
  title,
  timeLabel,
  platform,
  meetLink,
}: {
  title: string;
  /** Pre-formatted, e.g. "Tuesday, March 4, 2026 at 2:00 PM EST" — email HTML can't do client-side timezone conversion. */
  timeLabel: string;
  platform: string;
  meetLink: string | null;
}) {
  return (
    <EmailLayout preview={`"${title}" is confirmed for ${timeLabel}`}>
      <Heading style={{ fontSize: "18px", margin: "0 0 12px" }}>
        &ldquo;{title}&rdquo; is confirmed
      </Heading>
      <Text style={{ fontSize: "14px", color: "#334155", lineHeight: "22px" }}>
        {timeLabel} via {platform}.
      </Text>
      {meetLink ? (
        <Button href={meetLink} style={emailButtonStyle}>
          Join meeting
        </Button>
      ) : (
        <Text style={{ fontSize: "13px", color: "#94A3B8" }}>
          A calendar invite has been sent — check your calendar for the join link.
        </Text>
      )}
    </EmailLayout>
  );
}
