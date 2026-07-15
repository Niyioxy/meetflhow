import { extractClip } from "@/lib/audio/pcm";
import { getEmbedding, cosineSimilarity, averageEmbeddings } from "@/lib/voice";
import { getCandidateProfiles } from "@/lib/voice-profile";
import type { TranscriptUtterance } from "@/lib/deepgram/transcribe";

const CONFIDENT_THRESHOLD = 0.65;
const TENTATIVE_THRESHOLD = 0.5;
const MAX_CLIPS_PER_SPEAKER = 3;
const MIN_CLIP_SECONDS = 1.5;

export interface VoiceMatch {
  userId: string;
  name: string;
  confidence: number;
}

/**
 * For each diarized Deepgram speaker label, extracts a few representative
 * utterance clips, embeds and averages them, and compares the result against
 * every enrolled voice profile that's a candidate for this meeting (owner +
 * workspace members). Returns a map of Deepgram speaker label -> matched
 * user, for labels that clear at least the tentative confidence threshold.
 * Best-effort: never throws for audio/model issues, only for missing config
 * (e.g. VOICE_SERVICE_URL unset), which the caller should still wrap in
 * try/catch since this is a supplementary feature.
 *
 * All clip embeddings are requested concurrently (not sequentially) — this
 * pipeline runs synchronously inside the meeting-upload request, which has a
 * hard platform time budget, so a slow/unreachable voice-service must cost
 * at most one call's worth of latency (bounded by getEmbedding's own
 * timeout), not one timeout per clip stacked on top of each other.
 */
export async function matchSpeakersByVoice(
  audioBuffer: Buffer,
  utterances: TranscriptUtterance[],
  meeting: { userId: string; workspaceId: string | null }
): Promise<Record<string, VoiceMatch>> {
  if (utterances.length === 0) return {};

  const candidates = await getCandidateProfiles(meeting);
  if (candidates.length === 0) return {};

  const bySpeaker = new Map<number, TranscriptUtterance[]>();
  for (const u of utterances) {
    const list = bySpeaker.get(u.speaker) ?? [];
    list.push(u);
    bySpeaker.set(u.speaker, list);
  }

  const duration = (u: TranscriptUtterance) => u.end - u.start;
  const clipJobs: { speaker: number; clip: TranscriptUtterance }[] = [];
  for (const [speaker, speakerUtterances] of Array.from(bySpeaker.entries())) {
    const clips = speakerUtterances
      .filter((u) => duration(u) >= MIN_CLIP_SECONDS)
      .sort((a, b) => duration(b) - duration(a))
      .slice(0, MAX_CLIPS_PER_SPEAKER);
    for (const clip of clips) clipJobs.push({ speaker, clip });
  }

  const results = await Promise.allSettled(
    clipJobs.map(async ({ speaker, clip }) => {
      const wav = await extractClip(audioBuffer, clip.start, clip.end);
      const embedding = await getEmbedding(wav, `speaker-${speaker}.wav`);
      return { speaker, embedding };
    })
  );

  const embeddingsBySpeaker = new Map<number, number[][]>();
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Voice identification: failed to embed clip", result.reason);
      continue;
    }
    const { speaker, embedding } = result.value;
    const list = embeddingsBySpeaker.get(speaker) ?? [];
    list.push(embedding);
    embeddingsBySpeaker.set(speaker, list);
  }

  const matches: Record<string, VoiceMatch> = {};

  for (const [speaker, embeddings] of Array.from(embeddingsBySpeaker.entries())) {
    const speakerEmbedding = averageEmbeddings(embeddings);

    let bestIndex = -1;
    let bestScore = 0;
    candidates.forEach((candidate, i) => {
      const score = cosineSimilarity(speakerEmbedding, candidate.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    });

    if (bestIndex >= 0 && bestScore >= TENTATIVE_THRESHOLD) {
      matches[String(speaker)] = {
        userId: candidates[bestIndex].userId,
        name: candidates[bestIndex].name,
        confidence: bestScore,
      };
    }
  }

  return matches;
}

export { CONFIDENT_THRESHOLD };
