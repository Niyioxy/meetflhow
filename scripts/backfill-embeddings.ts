/**
 * One-time, manual backfill: indexes every existing transcript that doesn't
 * already have transcript_chunks rows. Run once after the migration adding
 * transcript_chunks/pgvector is applied and this code is deployed.
 *
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * Deliberately not wired into CI/CD or the migration itself — it makes real
 * Gemini embedding calls (cost + rate limits) across all existing transcripts.
 */
import { db } from "../db";
import { transcripts } from "../db/schema";
import { indexTranscript } from "../lib/search/index-transcript";
import { sql } from "drizzle-orm";

async function main() {
  const pending = await db
    .select({ id: transcripts.id, meetingId: transcripts.meetingId, fullText: transcripts.fullText })
    .from(transcripts)
    .where(
      sql`NOT EXISTS (SELECT 1 FROM transcript_chunks WHERE transcript_chunks.transcript_id = transcripts.id)`
    );

  console.log(`Found ${pending.length} transcripts to backfill.`);

  for (let i = 0; i < pending.length; i++) {
    const t = pending[i];
    try {
      await indexTranscript(t.id, t.meetingId, t.fullText);
      console.log(`[${i + 1}/${pending.length}] indexed transcript ${t.id}`);
    } catch (error) {
      console.error(`[${i + 1}/${pending.length}] FAILED transcript ${t.id}`, error);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("Backfill complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
