CREATE TABLE "outbound_effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"effect_key" text NOT NULL,
	"kind" text NOT NULL,
	"meeting_id" uuid,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"claim_id" uuid,
	"claimed_at" timestamp,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "outbound_effects_effect_key_unique" UNIQUE("effect_key")
);
--> statement-breakpoint
ALTER TABLE "analysis" ADD COLUMN "core_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "processing_attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "processing_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "action_item_id" uuid;--> statement-breakpoint
ALTER TABLE "outbound_effects" ADD CONSTRAINT "outbound_effects_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbound_effects_meeting_idx" ON "outbound_effects" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "outbound_effects_status_idx" ON "outbound_effects" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_action_item_id_action_items_id_fk" FOREIGN KEY ("action_item_id") REFERENCES "public"."action_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Reconcile duplicates left by the old non-idempotent pipeline before the
-- unique constraints below are added. Every step is a single statement (no
-- temp tables), and each is safe to re-run.
-- ---------------------------------------------------------------------------

-- Transcripts: keep, per meeting, the row with speaker segments, then with
-- utterances, then the oldest. If the keeper has no search chunks but a
-- duplicate does, adopt that duplicate's chunks so search keeps working.
WITH ranked AS (
	SELECT id, meeting_id, row_number() OVER (
		PARTITION BY meeting_id
		ORDER BY (speaker_segments IS NOT NULL) DESC, (utterances IS NOT NULL) DESC, created_at, id
	) AS rn
	FROM transcripts
),
keepers AS (SELECT meeting_id, id AS keeper_id FROM ranked WHERE rn = 1),
losers AS (
	SELECT r.id AS loser_id, k.keeper_id
	FROM ranked r JOIN keepers k USING (meeting_id)
	WHERE r.rn > 1
),
donors AS (
	SELECT DISTINCT ON (l.keeper_id) l.keeper_id, l.loser_id
	FROM losers l
	WHERE NOT EXISTS (SELECT 1 FROM transcript_chunks c WHERE c.transcript_id = l.keeper_id)
		AND EXISTS (SELECT 1 FROM transcript_chunks c WHERE c.transcript_id = l.loser_id)
	ORDER BY l.keeper_id, l.loser_id
)
UPDATE transcript_chunks c SET transcript_id = d.keeper_id
FROM donors d
WHERE c.transcript_id = d.loser_id;--> statement-breakpoint

WITH ranked AS (
	SELECT id, row_number() OVER (
		PARTITION BY meeting_id
		ORDER BY (speaker_segments IS NOT NULL) DESC, (utterances IS NOT NULL) DESC, created_at, id
	) AS rn
	FROM transcripts
)
DELETE FROM transcripts t USING ranked r WHERE t.id = r.id AND r.rn > 1;--> statement-breakpoint

-- Search chunks: repeated indexing inserted the same (transcript, index) pair
-- more than once. Keep the oldest of each.
WITH ranked AS (
	SELECT id, row_number() OVER (PARTITION BY transcript_id, chunk_index ORDER BY created_at, id) AS rn
	FROM transcript_chunks
)
DELETE FROM transcript_chunks c USING ranked r WHERE c.id = r.id AND r.rn > 1;--> statement-breakpoint

-- Analysis: keep, per meeting, the row with a summary (then the oldest), and
-- fold any supplementary output only a duplicate has into it first.
WITH ranked AS (
	SELECT id, meeting_id, row_number() OVER (
		PARTITION BY meeting_id ORDER BY (summary <> '') DESC, created_at, id
	) AS rn
	FROM analysis
),
keepers AS (SELECT meeting_id, id AS keeper_id FROM ranked WHERE rn = 1),
merged AS (
	SELECT
		k.keeper_id,
		(array_agg(a.meeting_score ORDER BY a.created_at, a.id) FILTER (WHERE a.meeting_score IS NOT NULL))[1] AS meeting_score,
		(array_agg(a.sentiment_timeline ORDER BY a.created_at, a.id) FILTER (WHERE a.sentiment_timeline IS NOT NULL))[1] AS sentiment_timeline,
		(array_agg(a.vertical_content ORDER BY a.created_at, a.id) FILTER (WHERE a.vertical_content IS NOT NULL))[1] AS vertical_content,
		count(*) AS n
	FROM analysis a JOIN keepers k USING (meeting_id)
	GROUP BY k.keeper_id
)
UPDATE analysis a SET
	meeting_score = COALESCE(a.meeting_score, m.meeting_score),
	sentiment_timeline = COALESCE(a.sentiment_timeline, m.sentiment_timeline),
	vertical_content = COALESCE(a.vertical_content, m.vertical_content)
FROM merged m
WHERE a.id = m.keeper_id AND m.n > 1;--> statement-breakpoint

WITH ranked AS (
	SELECT id, row_number() OVER (
		PARTITION BY meeting_id ORDER BY (summary <> '') DESC, created_at, id
	) AS rn
	FROM analysis
)
DELETE FROM analysis a USING ranked r WHERE a.id = r.id AND r.rn > 1;--> statement-breakpoint

-- Treat an analysis as complete only where the old pipeline demonstrably ran
-- to the end (the meeting reached "ready"). A summary on a meeting that never
-- got there may be missing its action items/tasks, so it's left incomplete
-- and a retry finishes it (see runCoreAnalysis in lib/meetings.ts).
UPDATE analysis a SET core_completed_at = a.created_at
FROM meetings m
WHERE m.id = a.meeting_id AND m.status = 'ready' AND a.summary <> '' AND a.core_completed_at IS NULL;--> statement-breakpoint

-- Link existing tasks to the action item they were created from. Pair them
-- one-to-one by meeting + identical text, in creation order, so two action
-- items with the same text each get their own task rather than both
-- matching the first one.
WITH t AS (
	SELECT id, meeting_id, title, row_number() OVER (PARTITION BY meeting_id, title ORDER BY created_at, id) AS rn
	FROM tasks
	WHERE meeting_id IS NOT NULL AND action_item_id IS NULL
),
ai AS (
	SELECT id, meeting_id, task, row_number() OVER (PARTITION BY meeting_id, task ORDER BY created_at, id) AS rn
	FROM action_items
	WHERE NOT EXISTS (SELECT 1 FROM tasks linked WHERE linked.action_item_id = action_items.id)
)
UPDATE tasks SET action_item_id = ai.id
FROM t JOIN ai ON ai.meeting_id = t.meeting_id AND ai.task = t.title AND ai.rn = t.rn
WHERE tasks.id = t.id;--> statement-breakpoint

-- Fencing check for the processing lease. Called as the first statement of
-- every batch that commits a pipeline stage's output: it row-locks the
-- meeting until the batch commits (so a concurrent reclaim waits and then
-- re-checks) and aborts the whole batch if this attempt no longer owns it.
CREATE OR REPLACE FUNCTION meetflhow_assert_processing_lease(p_meeting_id uuid, p_attempt_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM 1 FROM meetings WHERE id = p_meeting_id AND processing_attempt_id = p_attempt_id FOR UPDATE;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'processing_lease_lost: meeting % is no longer owned by attempt %', p_meeting_id, p_attempt_id;
	END IF;
	RETURN 1;
END;
$$;--> statement-breakpoint

ALTER TABLE "analysis" ADD CONSTRAINT "analysis_meeting_id_unique" UNIQUE("meeting_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_action_item_id_unique" UNIQUE("action_item_id");--> statement-breakpoint
ALTER TABLE "transcript_chunks" ADD CONSTRAINT "transcript_chunks_transcript_chunk_unique" UNIQUE("transcript_id","chunk_index");--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_meeting_id_unique" UNIQUE("meeting_id");
