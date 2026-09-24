import { getEmailClient } from "@/lib/email/client";

export async function sendFollowUpEmail({
  to,
  replyTo,
  subject,
  bodyHtml,
  messageId,
}: {
  to: string[];
  replyTo: string | null;
  subject: string;
  bodyHtml: string;
  messageId?: string;
}) {
  await getEmailClient().emails.send({
    from: process.env.EMAIL_FROM || "MeetFlhow <reminders@meetflow.app>",
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    html: bodyHtml,
    messageId,
  });
}
