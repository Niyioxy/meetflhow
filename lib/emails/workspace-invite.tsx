import { Button, Heading, Text } from "@react-email/components";
import { EmailLayout, emailButtonStyle } from "@/lib/emails/layout";

export function WorkspaceInviteEmail({
  inviterName,
  workspaceName,
  role,
  acceptUrl,
}: {
  inviterName: string;
  workspaceName: string;
  role: string;
  acceptUrl: string;
}) {
  return (
    <EmailLayout preview={`${inviterName} invited you to ${workspaceName} on MeetFlhow`}>
      <Heading style={{ fontSize: "18px", margin: "0 0 12px" }}>
        You&apos;ve been invited to {workspaceName}
      </Heading>
      <Text style={{ fontSize: "14px", color: "#334155", lineHeight: "22px" }}>
        {inviterName} invited you to join <strong>{workspaceName}</strong> on MeetFlhow as a{" "}
        <strong>{role}</strong>.
      </Text>
      <Button href={acceptUrl} style={emailButtonStyle}>
        Accept Invitation
      </Button>
    </EmailLayout>
  );
}
