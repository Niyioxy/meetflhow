import type { SpeakerSegment } from "@/types/analysis";

export interface ShareSettings {
  show_transcript: boolean;
  show_action_items: boolean;
  show_cost: boolean;
  show_score: boolean;
}

export interface ShareLinkView extends ShareSettings {
  id: string;
  token: string;
  has_password: boolean;
  expires_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

export interface PublicShareActionItem {
  task: string;
  owner: string | null;
  due_date: string | null;
  priority: string;
}

export interface PublicSharePayload extends ShareSettings {
  meeting_title: string;
  meeting_date: string;
  platform: string;
  duration_seconds: number | null;
  shared_by_name: string | null;
  shared_by_image: string | null;
  password_protected: boolean;
  locked: boolean;
  summary: string | null;
  decisions: string[];
  action_items: PublicShareActionItem[] | null;
  transcript_full_text: string | null;
  transcript_segments: SpeakerSegment[] | null;
  score: { overall_score: number; feedback: string } | null;
}
