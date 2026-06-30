import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

export function EmailLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#F8FAFC", fontFamily: "Helvetica, Arial, sans-serif" }}>
        <Container style={{ maxWidth: "480px", margin: "0 auto", padding: "32px 24px" }}>
          <Text style={{ fontSize: "20px", fontWeight: 700, color: "#2563EB", margin: "0 0 24px" }}>
            MeetFlhow
          </Text>
          <Section
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              padding: "24px",
            }}
          >
            {children}
          </Section>
          <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0 12px" }} />
          <Text style={{ fontSize: "12px", color: "#94A3B8", margin: 0 }}>MeetFlhow · Unsubscribe</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const emailButtonStyle = {
  display: "inline-block",
  backgroundColor: "#2563EB",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  padding: "10px 20px",
  borderRadius: "8px",
  marginTop: "16px",
};
