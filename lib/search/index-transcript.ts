import { db } from "@/db";
import { transcriptChunks } from "@/db/schema";
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

export async function indexTranscript(
  transcriptId: string,
  meetingId: string,
  fullText: string
): Promise<void> {
  const chunks = splitIntoChunks(fullText);
  if (chunks.length === 0) return;

  const embeddings = await embedChunks(chunks);

  await db.insert(transcriptChunks).values(
    chunks.map((content, i) => ({
      meetingId,
      transcriptId,
      chunkIndex: i,
      content,
      embedding: embeddings[i],
    }))
  );
}
