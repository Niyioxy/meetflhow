import type { MentionContextType } from "@/db/schema";

export type { MentionContextType };

export interface MentionableMember {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface MentionView {
  id: string;
  from_user_id: string;
  from_user_name: string | null;
  context_type: MentionContextType;
  context_id: string;
  context_text: string | null;
  meeting_id: string | null;
  meeting_title: string | null;
  read: boolean;
  created_at: string;
}
