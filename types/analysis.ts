export interface MeetingCoachScore {
  talk_time_ratio: number;
  decision_rate: number;
  clarity_score: number;
  overall_score: number;
  coach_feedback: string;
  strengths: string[];
  improvements: string[];
}

export type SentimentLabel =
  | "very_positive"
  | "positive"
  | "neutral"
  | "tense"
  | "negative";

export type EnergyLevel = "high" | "medium" | "low";

export interface SentimentTimelineSegment {
  segment: number;
  sentiment: SentimentLabel;
  score: number;
  key_moment: string;
  energy: EnergyLevel;
}

export interface SentimentTimeline {
  segments: SentimentTimelineSegment[];
  overall_sentiment: string;
  most_positive_moment: string;
  most_tense_moment: string;
}

export type SpeakerIdentificationMethod = "voice_match" | "ai_inference" | "manual";

/** One diarized turn from Deepgram — canonical definition, re-exported from lib/deepgram/transcribe for backward compatibility. */
export interface TranscriptUtterance {
  speaker: number;
  start: number;
  end: number;
  transcript: string;
}

export interface SermonGuide {
  kind: "sermon_guide";
  centralTheme: string;
  scriptureReferences: string[];
  discussionQuestions: string[];
}

export interface PodcastNotes {
  kind: "podcast_notes";
  episodeSummary: string;
  chapters: { title: string; description: string }[];
  pullQuotes: string[];
}

/** Content-type-native output — sermon discussion guides, podcast show notes — distinct from the generic meeting summary/highlights. */
export type VerticalContent = SermonGuide | PodcastNotes;

export interface SpeakerSegment {
  speaker: string;
  text: string;
  timestamp_approx: string;
  identificationMethod?: SpeakerIdentificationMethod;
  matchedUserId?: string | null;
  confidence?: number | null;
}

export type AgendaItemType = "update" | "discussion" | "decision" | "action_review";

export interface AgendaItem {
  item: string;
  duration_minutes: number;
  notes: string;
  type: AgendaItemType;
}

export interface SuggestedAgenda {
  suggested_duration: number;
  agenda_items: AgendaItem[];
  pre_meeting_prep: string[];
  goals: string[];
}

export interface FollowUpEmailContent {
  subject: string;
  body: string;
  preview_text: string;
}

/** A verbatim transcript quote backing a Sermon Coach observation. */
export interface SermonCoachEvidence {
  excerpt: string;
  /** "m:ss" / "h:mm:ss" from the recording; null for pasted transcripts. */
  timestamp: string | null;
}

export interface SermonCoachObservation {
  point: string;
  evidence: SermonCoachEvidence;
}

export const sermonCoachDimensionKeys = [
  "bigIdeaClarity",
  "scriptureGrounding",
  "structureAndFlow",
  "applicationStrength",
  "illustrationEffectiveness",
  "audienceAccessibility",
  "engagementAndDelivery",
] as const;
export type SermonCoachDimensionKey = (typeof sermonCoachDimensionKeys)[number];

export interface SermonCoachDimension {
  /**
   * 0-100, scored against the rubric in lib/sermon-coach/rubric.ts. Null
   * when none of the model's quotes for it could be found in the sermon —
   * an unsupported score is withheld rather than shown or averaged.
   */
  score: number | null;
  insufficientEvidence: boolean;
  summary: string;
  evidence: SermonCoachEvidence[];
}

/**
 * A factual or textual claim the preacher should double-check — tied to a
 * passage actually cited in the sermon. Never a judgement on whether the
 * claim is theologically correct.
 */
export interface SermonCoachClaim {
  claim: string;
  passage: string;
  reason: string;
  /** Where the claim is made. */
  evidence: SermonCoachEvidence;
  /** Where the passage is cited. */
  passageEvidence: SermonCoachEvidence;
}

/** Private feedback for the preacher. Every observation is backed by a verbatim quote. */
export interface SermonCoach {
  version: 1;
  generatedAt: string;
  timestampsAvailable: boolean;
  /** The workspace tradition lens used, if any. */
  tradition: string | null;
  /** Mean of the dimensions with grounded evidence; null if none had any. */
  overallScore: number | null;
  dimensions: Record<SermonCoachDimensionKey, SermonCoachDimension>;
  strengths: SermonCoachObservation[];
  improvements: SermonCoachObservation[];
  unclearOrRepetitive: SermonCoachObservation[];
  claimsToVerify: SermonCoachClaim[];
  strongestMoment: SermonCoachObservation | null;
  suggestedCuts: SermonCoachObservation[];
  nextSermonFocus: SermonCoachObservation | null;
  traditionNotes: SermonCoachObservation[];
  /** Observations dropped because their quote couldn't be found in the transcript. */
  omittedForMissingEvidence: number;
}
