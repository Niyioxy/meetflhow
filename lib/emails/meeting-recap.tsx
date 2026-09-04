import { Button, Heading, Text } from "@react-email/components";
import { EmailLayout, emailButtonStyle } from "@/lib/emails/layout";

export function MeetingRecapEmail({
  title,
  summary,
  shareUrl,
  senderName,
  isAutomaticNoShow,
}: {
  title: string;
  summary: string;
  shareUrl: string;
  senderName: string | null;
  /** Slightly different framing when this was triggered automatically because the recipient was invited but didn't attend, versus someone manually sharing it. */
  isAutomaticNoShow: boolean;
}) {
  return (
    <EmailLayout preview={`Catch up on "${title}"`}>
      <Heading style={{ fontSize: "18px", margin: "0 0 12px" }}>
        {isAutomaticNoShow
          ? `You missed "${title}" — here's what happened`
          : `Here's a recap of "${title}"`}
      </Heading>
      <Text style={{ fontSize: "14px", color: "#334155", lineHeight: "22px" }}>{summary}</Text>
      <Button href={shareUrl} style={emailButtonStyle}>
        View full recap
      </Button>
      {senderName && (
        <Text style={{ fontSize: "12px", color: "#94A3B8", marginTop: "16px" }}>
          {isAutomaticNoShow
            ? `You were invited to this meeting by ${senderName}. Sent automatically via MeetFlhow.`
            : `Sent by ${senderName} via MeetFlhow.`}
        </Text>
      )}
    </EmailLayout>
  );
}
