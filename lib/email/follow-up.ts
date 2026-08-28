import { getEmailClient } from "@/lib/email/client";

export async function sendFollowUpEmail({
  to,
  replyTo,
  subject,
  bodyHtml,
}: {
  to: string[];
  replyTo: string | null;
  subject: string;
  bodyHtml: string;
}) {
  await getEmailClient().emails.send({
    from: process.env.EMAIL_FROM || "MeetFlhow <reminders@meetflow.app>",
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    html: bodyHtml,
  });
}
