import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { db } from "@/db";
import { scheduledFollowUpEmails } from "@/db/schema";
import { ensureTranscriptOwnership } from "@/lib/meetings";
import { sendFollowUpEmail } from "@/lib/email/follow-up";

const bodySchema = z.object({
  recipients: z.array(z.string().email()).min(1),
  replyTo: z.string().email().nullable().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  when: z.enum(["now", "tomorrow_9am"]),
});

function tomorrowAt9am(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await ensureTranscriptOwnership(params.id, session.user.id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { recipients, replyTo, subject, body, when } = parsed.data;

  if (when === "now") {
    try {
      await sendFollowUpEmail({ to: recipients, replyTo: replyTo ?? null, subject, bodyHtml: body });
      return NextResponse.json({ status: "sent", recipientCount: recipients.length });
    } catch (error) {
      console.error("Failed to send follow-up email", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }
  }

  const [scheduled] = await db
    .insert(scheduledFollowUpEmails)
    .values({
      meetingId: meeting.id,
      recipients,
      replyTo: replyTo ?? null,
      subject,
      bodyHtml: body,
      sendAt: tomorrowAt9am(),
    })
    .returning();

  return NextResponse.json({ status: "scheduled", sendAt: scheduled.sendAt });
}
