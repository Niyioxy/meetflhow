CREATE TABLE "translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"target_language" text NOT NULL,
	"translated_summary" text,
	"translated_transcript" jsonb,
	"translated_action_items" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "translations_meeting_id_target_language_unique" UNIQUE("meeting_id","target_language")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "translations" ADD CONSTRAINT "translations_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;