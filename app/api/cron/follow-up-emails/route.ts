import { NextResponse } from "next/server";
import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { scheduledFollowUpEmails } from "@/db/schema";
import { sendFollowUpEmail } from "@/lib/email/follow-up";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await db
    .select()
    .from(scheduledFollowUpEmails)
    .where(
      and(
        lte(scheduledFollowUpEmails.sendAt, new Date()),
        isNull(scheduledFollowUpEmails.sentAt)
      )
    );

  let sent = 0;
  for (const email of due) {
    try {
      await sendFollowUpEmail({
        to: email.recipients,
        replyTo: email.replyTo,
        subject: email.subject,
        bodyHtml: email.bodyHtml,
      });
      await db
        .update(scheduledFollowUpEmails)
        .set({ sentAt: new Date() })
        .where(eq(scheduledFollowUpEmails.id, email.id));
      sent += 1;
    } catch (error) {
      console.error(`Failed to send scheduled follow-up email ${email.id}`, error);
    }
  }

  return NextResponse.json({ checked: due.length, sent });
}
