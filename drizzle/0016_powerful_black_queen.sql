CREATE TABLE "booking_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"invitee_email" text NOT NULL,
	"platform" text NOT NULL,
	"proposed_slots" jsonb NOT NULL,
	"organizer_timezone" text NOT NULL,
	"token" text NOT NULL,
	"selected_slot" timestamp,
	"scheduled_meeting_id" uuid,
	"responded_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "booking_requests_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_requests" ADD CONSTRAINT "booking_requests_scheduled_meeting_id_scheduled_meetings_id_fk" FOREIGN KEY ("scheduled_meeting_id") REFERENCES "public"."scheduled_meetings"("id") ON DELETE set null ON UPDATE no action;