import { db } from "@/db";
import { createOrUpdateShare } from "@/lib/shares";
import { getEmailClient } from "@/lib/email/client";
import { MeetingRecapEmail } from "@/lib/emails/meeting-recap";

/**
 * Emails a recap of a meeting to someone who missed it — the share link
 * (created if one doesn't already exist) plus the summary inline. Used
 * both by the manual "email recap" action and by the automatic no-show
 * detector, so the two never drift apart.
 */
export async function sendMeetingRecapEmail(
  meetingId: string,
  ownerUserId: string,
  recipientEmail: string,
  isAutomaticNoShow = false
): Promise<void> {
  const meeting = await db.query.meetings.findFirst({
    where: (m, { and, eq }) => and(eq(m.id, meetingId), eq(m.userId, ownerUserId)),
    with: { analysis: true, user: true },
  });
  if (!meeting) throw new Error("Meeting not found");
  if (!meeting.analysis?.summary) throw new Error("This meeting hasn't finished processing yet");

  const share = await createOrUpdateShare(meetingId, ownerUserId, {});
  const shareUrl = `${process.env.NEXTAUTH_URL}/share/${share.token}`;

  await getEmailClient().emails.send({
    from: process.env.EMAIL_FROM || "MeetFlhow <reminders@meetflow.app>",
    to: recipientEmail,
    subject: `Catch up on "${meeting.title}"`,
    react: MeetingRecapEmail({
      title: meeting.title,
      summary: meeting.analysis.summary,
      shareUrl,
      senderName: meeting.user.name,
      isAutomaticNoShow,
    }),
  });
}
