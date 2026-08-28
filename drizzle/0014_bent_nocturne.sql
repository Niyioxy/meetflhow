CREATE TABLE "call_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"daily_room_name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"meeting_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	CONSTRAINT "call_rooms_daily_room_name_unique" UNIQUE("daily_room_name")
);
--> statement-breakpoint
ALTER TABLE "call_rooms" ADD CONSTRAINT "call_rooms_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_rooms" ADD CONSTRAINT "call_rooms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_rooms" ADD CONSTRAINT "call_rooms_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE no action ON UPDATE no action;