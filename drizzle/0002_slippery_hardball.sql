CREATE TABLE "scheduled_follow_up_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"recipients" text[] DEFAULT '{}' NOT NULL,
	"reply_to" text,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"send_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis" ADD COLUMN "meeting_score" jsonb;--> statement-breakpoint
ALTER TABLE "analysis" ADD COLUMN "sentiment_timeline" jsonb;--> statement-breakpoint
ALTER TABLE "transcripts" ADD COLUMN "speaker_segments" jsonb;--> statement-breakpoint
ALTER TABLE "scheduled_follow_up_emails" ADD CONSTRAINT "scheduled_follow_up_emails_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;