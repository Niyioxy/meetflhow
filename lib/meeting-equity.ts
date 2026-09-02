import type { SpeakerSegment } from "@/types/analysis";

export interface EquityRow {
  speaker: string;
  words: number;
  share: number; // 0-100
}

export interface EquityScore {
  rows: EquityRow[];
  totalWords: number;
  /** True once one speaker holds more than half the conversation. */
  dominated: boolean;
  topSpeaker: EquityRow | null;
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Turns diarization data that already exists on every processed meeting
 * into an airtime-fairness view — no new AI calls, no new data collection,
 * just a different lens on what's already there. Word count (not raw
 * seconds) is the fairness proxy since that's what speakerSegments
 * actually carries per turn.
 */
export function computeEquityScore(segments: SpeakerSegment[]): EquityScore | null {
  const wordsBySpeaker = new Map<string, number>();

  for (const segment of segments) {
    const words = wordCount(segment.text);
    if (words === 0) continue;
    wordsBySpeaker.set(segment.speaker, (wordsBySpeaker.get(segment.speaker) ?? 0) + words);
  }

  if (wordsBySpeaker.size < 2) return null;

  const totalWords = Array.from(wordsBySpeaker.values()).reduce((sum, w) => sum + w, 0);
  if (totalWords === 0) return null;

  const rows: EquityRow[] = Array.from(wordsBySpeaker, ([speaker, words]) => ({
    speaker,
    words,
    share: Math.round((words / totalWords) * 1000) / 10,
  })).sort((a, b) => b.words - a.words);

  const topSpeaker = rows[0] ?? null;

  return {
    rows,
    totalWords,
    dominated: (topSpeaker?.share ?? 0) > 50,
    topSpeaker,
  };
}
