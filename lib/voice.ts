function getServiceUrl(): string {
  const url = process.env.VOICE_SERVICE_URL;
  if (!url) {
    throw new Error("VOICE_SERVICE_URL is not set");
  }
  return url;
}

const EMBED_TIMEOUT_MS = 8000;

/** Sends an audio buffer to the voice-service and returns its 192-dim speaker embedding. */
export async function getEmbedding(audioBuffer: Buffer, filename = "audio.wav"): Promise<number[]> {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(audioBuffer)]), filename);

  let res: Response;
  try {
    res = await fetch(`${getServiceUrl()}/embed`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`Voice service /embed timed out after ${EMBED_TIMEOUT_MS}ms`);
    }
    throw error;
  }

  if (!res.ok) {
    throw new Error(`Voice service /embed failed with status ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data.embedding)) {
    throw new Error("Voice service returned an invalid embedding");
  }
  return data.embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function averageEmbeddings(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const length = vectors[0].length;
  const sum = new Array(length).fill(0);
  for (const vec of vectors) {
    for (let i = 0; i < length; i++) sum[i] += vec[i];
  }
  return sum.map((v) => v / vectors.length);
}
