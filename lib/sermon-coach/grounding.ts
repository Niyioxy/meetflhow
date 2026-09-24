import {
  sermonCoachDimensionKeys,
  type SermonCoach,
  type SermonCoachClaim,
  type SermonCoachDimension,
  type SermonCoachDimensionKey,
  type SermonCoachEvidence,
  type SermonCoachObservation,
  type TranscriptUtterance,
} from "@/types/analysis";

/**
 * Evidence grounding for Sermon Coach. The model is told to back every
 * observation with a verbatim transcript quote; this checks that the quote
 * really is in the transcript and derives its timestamp from Deepgram's
 * utterance timings (never from the model). Anything whose quote can't be
 * found is dropped — no evidence, no observation.
 */

/** Shorter quotes ("Amen", "Let's pray") match almost anywhere, so prove nothing. */
export const MIN_EXCERPT_WORDS = 4;
/** Longer isn't a targeted quote any more. */
export const MAX_EXCERPT_WORDS = 80;

const TIMESTAMP_MARKER = /\[\d{1,2}:\d{2}(?::\d{2})?\]/g;
// Built via the constructor: tsconfig has no `target`, so a regex literal
// with the `u` flag (needed for \p{…}) is rejected at type-check time.
const NON_WORD_CHARS = new RegExp("[^\\p{L}\\p{N}\\s]", "gu");

/** Case, punctuation and whitespace-insensitive form used for matching only. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(NON_WORD_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = (s % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export interface TranscriptIndex {
  /** Normalized transcript text. */
  text: string;
  /** Start offset in `text` of each utterance and its start time; null without timings. */
  starts: { offset: number; seconds: number }[] | null;
}

export function buildTranscriptIndex(
  fullText: string,
  utterances?: TranscriptUtterance[] | null
): TranscriptIndex {
  if (!utterances || utterances.length === 0) {
    return { text: normalizeForMatch(fullText), starts: null };
  }
  let text = "";
  const starts: { offset: number; seconds: number }[] = [];
  for (const u of utterances) {
    const piece = normalizeForMatch(u.transcript);
    if (!piece) continue;
    if (text) text += " ";
    starts.push({ offset: text.length, seconds: u.start });
    text += piece;
  }
  return { text, starts };
}

/** The transcript as shown to the model: timestamped lines when timings exist. */
export function transcriptForPrompt(fullText: string, utterances?: TranscriptUtterance[] | null): string {
  if (!utterances || utterances.length === 0) return fullText;
  return utterances.map((u) => `[${formatTimestamp(u.start)}] ${u.transcript}`).join("\n");
}

/** Evidence for `excerpt` if it appears verbatim (modulo case/punctuation) in the transcript, else null. */
export function locateExcerpt(index: TranscriptIndex, excerpt: string): SermonCoachEvidence | null {
  const cleaned = excerpt.replace(TIMESTAMP_MARKER, " ").trim();
  const needle = normalizeForMatch(cleaned);
  const words = needle ? needle.split(" ").length : 0;
  if (words < MIN_EXCERPT_WORDS || words > MAX_EXCERPT_WORDS) return null;

  // Whole-word match: pad both sides so "art" can't match inside "heart".
  const at = ` ${index.text} `.indexOf(` ${needle} `);
  if (at < 0) return null;

  let timestamp: string | null = null;
  if (index.starts) {
    let seconds = index.starts[0]?.seconds ?? 0;
    for (const start of index.starts) {
      if (start.offset > at) break;
      seconds = start.seconds;
    }
    timestamp = formatTimestamp(seconds);
  }
  return { excerpt: cleaned.replace(/\s+/g, " "), timestamp };
}

/** The model's output before grounding (see the response schema in lib/gemini/sermon-coach.ts). */
export interface RawObservation {
  point: string;
  excerpt: string;
}

export interface RawSermonCoach {
  dimensions: Record<SermonCoachDimensionKey, { score: number; summary: string; excerpts: string[] }>;
  strengths: RawObservation[];
  improvements: RawObservation[];
  unclearOrRepetitive: RawObservation[];
  suggestedCuts: RawObservation[];
  strongestMoment: RawObservation | null;
  nextSermonFocus: RawObservation | null;
  claimsToVerify: {
    claim: string;
    excerpt: string;
    passage: string;
    passageExcerpt: string;
    reason: string;
  }[];
  traditionNotes: RawObservation[];
}

const LIST_LIMITS = {
  strengths: 5,
  improvements: 5,
  unclearOrRepetitive: 4,
  suggestedCuts: 4,
  claimsToVerify: 6,
  traditionNotes: 4,
  evidencePerDimension: 3,
} as const;

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Turns raw model output into a SermonCoach where every surviving
 * observation carries a verified quote. Scores are clamped; a dimension
 * none of whose quotes survive is marked insufficientEvidence with no
 * score. The overall score is the plain mean of the dimensions that do
 * have evidence — computed here, not trusted from the model, so it's
 * consistent with what's displayed.
 */
export function groundSermonCoach(
  raw: RawSermonCoach,
  index: TranscriptIndex,
  tradition: string | null,
  now: Date = new Date()
): SermonCoach {
  let omitted = 0;

  const observe = (item: RawObservation | null | undefined): SermonCoachObservation | null => {
    if (!item || !item.point?.trim()) return null;
    const evidence = locateExcerpt(index, item.excerpt ?? "");
    if (!evidence) {
      omitted += 1;
      return null;
    }
    return { point: item.point.trim(), evidence };
  };

  const observeAll = (items: RawObservation[] | undefined, limit: number) =>
    (items ?? [])
      .map(observe)
      .filter((o): o is SermonCoachObservation => o !== null)
      .slice(0, limit);

  const dimensions = {} as Record<SermonCoachDimensionKey, SermonCoachDimension>;
  for (const key of sermonCoachDimensionKeys) {
    const d = raw.dimensions?.[key];
    const evidence: SermonCoachEvidence[] = [];
    for (const excerpt of d?.excerpts ?? []) {
      const found = locateExcerpt(index, excerpt);
      if (found) evidence.push(found);
      else omitted += 1;
    }
    // A score whose every supporting quote was fabricated is itself
    // unsupported: withhold it rather than display or average it.
    const insufficientEvidence = evidence.length === 0;
    dimensions[key] = {
      score: insufficientEvidence ? null : clampScore(d?.score ?? 0),
      insufficientEvidence,
      summary: d?.summary?.trim() ?? "",
      evidence: evidence.slice(0, LIST_LIMITS.evidencePerDimension),
    };
  }

  const claimsToVerify: SermonCoachClaim[] = [];
  for (const c of raw.claimsToVerify ?? []) {
    // Both quotes are required: where the claim is made, and where the
    // passage it's about is cited. Missing either, the claim is left out
    // entirely rather than shown as an unsupported warning.
    const evidence = locateExcerpt(index, c.excerpt ?? "");
    const passageEvidence = locateExcerpt(index, c.passageExcerpt ?? "");
    if (!evidence || !passageEvidence || !c.passage?.trim() || !c.claim?.trim()) {
      omitted += 1;
      continue;
    }
    claimsToVerify.push({
      claim: c.claim.trim(),
      passage: c.passage.trim(),
      reason: c.reason?.trim() ?? "",
      evidence,
      passageEvidence,
    });
  }

  const scores = sermonCoachDimensionKeys
    .map((key) => dimensions[key].score)
    .filter((s): s is number => s !== null);
  const overallScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null;

  return {
    version: 1,
    generatedAt: now.toISOString(),
    timestampsAvailable: index.starts !== null,
    tradition,
    overallScore,
    dimensions,
    strengths: observeAll(raw.strengths, LIST_LIMITS.strengths),
    improvements: observeAll(raw.improvements, LIST_LIMITS.improvements),
    unclearOrRepetitive: observeAll(raw.unclearOrRepetitive, LIST_LIMITS.unclearOrRepetitive),
    claimsToVerify: claimsToVerify.slice(0, LIST_LIMITS.claimsToVerify),
    strongestMoment: observe(raw.strongestMoment),
    suggestedCuts: observeAll(raw.suggestedCuts, LIST_LIMITS.suggestedCuts),
    nextSermonFocus: observe(raw.nextSermonFocus),
    // A tradition lens is only ever used when the workspace opted in.
    traditionNotes: tradition ? observeAll(raw.traditionNotes, LIST_LIMITS.traditionNotes) : [],
    omittedForMissingEvidence: omitted,
  };
}
