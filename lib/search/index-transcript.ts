import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { transcriptChunks } from "@/db/schema";
import { atomic } from "@/lib/processing/atomic";
import { embedChunks } from "@/lib/gemini/embed";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

/** Word-boundary sliding window — never cuts a chunk mid-word. */
export function splitIntoChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= CHUNK_SIZE) return [trimmed];

  const chunks: string[] = [];
  let start = 0;

  while (start < trimmed.length) {
    let end = Math.min(start + CHUNK_SIZE, trimmed.length);

    if (end < trimmed.length) {
      const lastSpace = trimmed.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }

    const chunk = trimmed.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= trimmed.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

/**
 * (Re)indexes a transcript for search. Replace semantics, in one
 * transaction: each chunk is upserted on (transcript_id, chunk_index), and
 * any chunks past the new last index (from an earlier, longer text) are
 * removed — so indexing the same transcript twice, or concurrently, never
 * duplicates search results.
 */
export async function indexTranscript(
  transcriptId: string,
  meetingId: string,
  fullText: string
): Promise<void> {
  const chunks = splitIntoChunks(fullText);
  const embeddings = chunks.length > 0 ? await embedChunks(chunks) : [];

  await atomic([
    chunks.length > 0 &&
      db
        .insert(transcriptChunks)
        .values(
          chunks.map((content, i) => ({
            meetingId,
            transcriptId,
            chunkIndex: i,
            content,
            embedding: embeddings[i],
          }))
        )
        .onConflictDoUpdate({
          target: [transcriptChunks.transcriptId, transcriptChunks.chunkIndex],
          set: {
            content: sql`excluded.content`,
            embedding: sql`excluded.embedding`,
            meetingId: sql`excluded.meeting_id`,
          },
        }),
    db
      .delete(transcriptChunks)
      .where(
        and(eq(transcriptChunks.transcriptId, transcriptId), gte(transcriptChunks.chunkIndex, chunks.length))
      ),
  ]);
}
