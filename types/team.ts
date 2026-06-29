export interface TeamMemberStats {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  total_meetings: number;
  total_hours: number;
  avg_score: number | null;
  completion_rate: number | null;
  most_common_platform: string | null;
  last_meeting: string | null;
  meeting_time_pct: number | null;
}

export interface BackToBackWarning {
  user_id: string;
  name: string | null;
  day: string;
  count: number;
}

export interface CollaborationPair {
  person_a: string;
  person_b: string;
  shared_meetings: number;
}

export interface TeamDashboardResponse {
  members: TeamMemberStats[];
  team_totals: {
    meetings: number;
    hours: number;
    cost: number;
    avg_score: number | null;
  };
  meeting_overlap: number;
  collaboration_map: CollaborationPair[];
  back_to_back_warnings: BackToBackWarning[];
}
