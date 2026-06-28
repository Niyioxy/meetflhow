import { format } from "date-fns";
import { getResendClient } from "@/lib/resend/client";

export async function sendMeetingReminderEmail({
  to,
  title,
  scheduledAt,
  platform,
  meetLink,
}: {
  to: string;
  title: string;
  scheduledAt: Date;
  platform: string;
  meetLink: string | null;
}) {
  const time = format(scheduledAt, "MMM d, yyyy 'at' h:mm a");

  await getResendClient().emails.send({
    from: process.env.EMAIL_FROM || "MeetFlow <reminders@meetflow.app>",
    to,
    subject: `Reminder: "${title}" starts in 30 minutes`,
    html: `
      <p>Your meeting <strong>${title}</strong> starts at ${time} (${platform}).</p>
      ${meetLink ? `<p><a href="${meetLink}">Join meeting</a></p>` : ""}
    `,
  });
}
