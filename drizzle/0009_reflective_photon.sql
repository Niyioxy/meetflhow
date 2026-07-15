ALTER TABLE "analysis" ADD COLUMN "highlights" text[];--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "content_type" text DEFAULT 'meeting' NOT NULL;