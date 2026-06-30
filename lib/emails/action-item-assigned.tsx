import { Button, Heading, Text } from "@react-email/components";
import { EmailLayout, emailButtonStyle } from "@/lib/emails/layout";

export function ActionItemAssignedEmail({
  meetingTitle,
  task,
  deadline,
  url,
}: {
  meetingTitle: string;
  task: string;
  deadline: string | null;
  url: string;
}) {
  return (
    <EmailLayout preview={`You've been assigned an action item in ${meetingTitle}`}>
      <Heading style={{ fontSize: "18px", margin: "0 0 12px" }}>
        You&apos;ve been assigned an action item
      </Heading>
      <Text style={{ fontSize: "13px", color: "#64748B", margin: "0 0 4px" }}>From {meetingTitle}</Text>
      <Text
        style={{
          fontSize: "14px",
          color: "#1E293B",
          backgroundColor: "#F8FAFC",
          borderRadius: "8px",
          padding: "12px",
        }}
      >
        {task}
      </Text>
      {deadline && (
        <Text style={{ fontSize: "13px", color: "#64748B" }}>Deadline: {deadline}</Text>
      )}
      <Button href={url} style={emailButtonStyle}>
        View in MeetFlhow
      </Button>
    </EmailLayout>
  );
}
