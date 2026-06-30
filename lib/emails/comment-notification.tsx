import { Button, Heading, Text } from "@react-email/components";
import { EmailLayout, emailButtonStyle } from "@/lib/emails/layout";

export function CommentNotificationEmail({
  commenterName,
  meetingTitle,
  commentText,
  meetingUrl,
}: {
  commenterName: string;
  meetingTitle: string;
  commentText: string;
  meetingUrl: string;
}) {
  return (
    <EmailLayout preview={`New comment on ${meetingTitle}`}>
      <Heading style={{ fontSize: "18px", margin: "0 0 12px" }}>New comment on {meetingTitle}</Heading>
      <Text style={{ fontSize: "14px", color: "#334155", lineHeight: "22px" }}>
        <strong>{commenterName}</strong> commented:
      </Text>
      <Text
        style={{
          fontSize: "14px",
          color: "#1E293B",
          backgroundColor: "#F8FAFC",
          borderRadius: "8px",
          padding: "12px",
        }}
      >
        {commentText}
      </Text>
      <Button href={meetingUrl} style={emailButtonStyle}>
        View in MeetFlhow
      </Button>
    </EmailLayout>
  );
}
