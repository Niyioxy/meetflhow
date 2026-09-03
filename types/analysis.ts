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
