import { gemini } from "./client";

const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONS = 768;
// Conservative batch size per embedContent call — sequential batches, not
// unbounded parallel requests, to stay rate-limit-friendly.
const BATCH_SIZE = 20;

/** Embeds a batch of transcript chunks for storage/retrieval. */
export async function embedChunks(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await gemini.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch,
      config: { outputDimensionality: OUTPUT_DIMENSIONS, taskType: "RETRIEVAL_DOCUMENT" },
    });
    if (!response.embeddings || response.embeddings.length !== batch.length) {
      throw new Error("Gemini embedContent returned an unexpected number of embeddings");
    }
    results.push(...response.embeddings.map((e) => e.values ?? []));
  }
  return results;
}

/** Embeds a single user question for retrieval. */
export async function embedQuery(text: string): Promise<number[]> {
  const response = await gemini.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: OUTPUT_DIMENSIONS, taskType: "RETRIEVAL_QUERY" },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values) throw new Error("Gemini did not return a query embedding");
  return values;
}
