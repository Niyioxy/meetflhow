import type { TranscriptUtterance } from "@/types/analysis";

export interface UnsaidMetrics {
  totalSilenceSeconds: number;
  longestSilenceSeconds: number;
  interruptionCount: number;
  interruptionsBySpeaker: { speaker: number; count: number }[];
  totalDurationSeconds: number;
}

/**
 * Gaps shorter than this are normal conversational breathing room, not
 * "silence" worth flagging — avoids treating every natural pause between
 * turns as a finding.
 */
const SILENCE_THRESHOLD_SECONDS = 1.5;

/**
 * A different axis than sentiment: conversation *dynamics* rather than
 * emotional tone. Needs real start/end timestamps (transcripts.utterances),
 * not the human-readable timestamp_approx strings on speakerSegments —
 * those aren't precise enough to detect an actual overlap. Speakers are
 * labeled by Deepgram's raw numeric index (0, 1, 2...) rather than a
 * resolved name, since that mapping isn't reliably reconstructable after
 * the fact from what's persisted today.
 */
export function computeUnsaidMetrics(utterances: TranscriptUtterance[]): UnsaidMetrics | null {
  if (utterances.length < 2) return null;

  const sorted = [...utterances].sort((a, b) => a.start - b.start);

  let totalSilenceSeconds = 0;
  let longestSilenceSeconds = 0;
  let interruptionCount = 0;
  const interruptionsBySpeakerMap = new Map<number, number>();

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = curr.start - prev.end;

    if (gap >= SILENCE_THRESHOLD_SECONDS) {
      totalSilenceSeconds += gap;
      longestSilenceSeconds = Math.max(longestSilenceSeconds, gap);
    } else if (gap < 0 && curr.speaker !== prev.speaker) {
      interruptionCount++;
      interruptionsBySpeakerMap.set(curr.speaker, (interruptionsBySpeakerMap.get(curr.speaker) ?? 0) + 1);
    }
  }

  const totalDurationSeconds = sorted[sorted.length - 1].end - sorted[0].start;
  if (totalDurationSeconds <= 0) return null;

  return {
    totalSilenceSeconds: Math.round(totalSilenceSeconds),
    longestSilenceSeconds: Math.round(longestSilenceSeconds),
    interruptionCount,
    interruptionsBySpeaker: Array.from(interruptionsBySpeakerMap, ([speaker, count]) => ({ speaker, count })).sort(
      (a, b) => b.count - a.count
    ),
    totalDurationSeconds: Math.round(totalDurationSeconds),
  };
}
