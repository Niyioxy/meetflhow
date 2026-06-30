import { Button, Heading, Text } from "@react-email/components";
import { EmailLayout, emailButtonStyle } from "@/lib/emails/layout";

const CONTEXT_LABEL: Record<string, string> = {
  action_item: "In an action item:",
  comment: "In a comment:",
  task: "In a task:",
  todo: "In a todo:",
};

export function MentionNotificationEmail({
  fromName,
  meetingTitle,
  contextType,
  contextText,
  url,
}: {
  fromName: string;
  meetingTitle: string;
  contextType: string;
  contextText: string;
  url: string;
}) {
  return (
    <EmailLayout preview={`${fromName} mentioned you in ${meetingTitle}`}>
      <Heading style={{ fontSize: "18px", margin: "0 0 12px" }}>
        {fromName} mentioned you in {meetingTitle}
      </Heading>
      <Text style={{ fontSize: "13px", color: "#64748B", margin: "0 0 4px" }}>
        {CONTEXT_LABEL[contextType] ?? "Mentioned you:"}
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
        {contextText}
      </Text>
      <Button href={url} style={emailButtonStyle}>
        View in MeetFlhow
      </Button>
    </EmailLayout>
  );
}
