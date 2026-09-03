export type DealSignalCategory = "buying" | "risk";

export interface DealSignal {
  phrase: string;
  category: DealSignalCategory;
}

/**
 * v1 is deliberately simple keyword matching over the live caption stream —
 * no new AI calls, runs entirely client-side, works the instant live
 * captions are on. Real buying-signal detection (tone, hedging, actual
 * intent) is a much harder problem; this catches the obvious, high-value
 * cases immediately without adding a live-streaming AI pipeline.
 */
const SIGNAL_PHRASES: DealSignal[] = [
  { phrase: "budget", category: "buying" },
  { phrase: "pricing", category: "buying" },
  { phrase: "when can we start", category: "buying" },
  { phrase: "sign off", category: "buying" },
  { phrase: "next steps", category: "buying" },
  { phrase: "not sure", category: "risk" },
  { phrase: "think about it", category: "risk" },
  { phrase: "too expensive", category: "risk" },
  { phrase: "competitor", category: "risk" },
  { phrase: "need to check with", category: "risk" },
  { phrase: "not the right time", category: "risk" },
];

export function detectSignals(text: string): DealSignal[] {
  const lower = text.toLowerCase();
  return SIGNAL_PHRASES.filter((s) => lower.includes(s.phrase));
}
