import { getResendClient } from "@/lib/resend/client";

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
  await getResendClient().emails.send({
    from: process.env.EMAIL_FROM || "MeetFlhow <reminders@meetflow.app>",
    to,
    ...(replyTo ? { replyTo } : {}),
    subject,
    html: bodyHtml,
  });
}
