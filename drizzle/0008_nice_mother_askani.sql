CREATE TABLE "voice_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"embedding" jsonb NOT NULL,
	"enrolment_quality" real,
	"sample_duration_seconds" integer,
	"consent_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "voice_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "transcripts" ADD COLUMN "speaker_identification_method" text DEFAULT 'ai_inference' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;