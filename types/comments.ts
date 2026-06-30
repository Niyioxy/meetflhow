export interface CommentReplyView {
  id: string;
  user_id: string;
  user_name: string | null;
  user_image: string | null;
  reply: string;
  created_at: string;
}

export interface TranscriptCommentView {
  id: string;
  meeting_id: string;
  user_id: string;
  user_name: string | null;
  user_image: string | null;
  segment_index: number;
  selected_text: string;
  comment: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  replies: CommentReplyView[];
}
