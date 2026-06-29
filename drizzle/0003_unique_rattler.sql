ALTER TABLE "action_items" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "action_items" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "attendee_salaries" jsonb;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "calculated_cost" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "insights_cache" jsonb;