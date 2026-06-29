export type InsightPeriod = "week" | "month" | "quarter";

export interface InsightsResponse {
  total_meetings: number;
  total_hours: number;
  total_cost: number;
  avg_meeting_duration: number;
  avg_meeting_score: number | null;
  hours_per_day: { date: string; hours: number }[];
  meetings_per_platform: { platform: string; count: number }[];
  busiest_day: string | null;
  busiest_hour: string | null;
  most_expensive_meeting: { id: string; title: string; cost: number } | null;
  most_productive_meeting: { id: string; title: string; score: number } | null;
  action_items_generated: number;
  decisions_made: number;
  time_trend: "improving" | "stable" | "worsening";
  score_trend: { id: string; date: string; title: string; score: number }[];
  heatmap: { day: number; hour: number; count: number }[];
  changes: {
    total_meetings: number | null;
    total_hours: number | null;
    total_cost: number | null;
    avg_meeting_score: number | null;
  };
}

export type InsightCardType = "warning" | "tip" | "win";

export interface InsightCard {
  title: string;
  description: string;
  type: InsightCardType;
}

export interface InsightsSummary {
  headline: string;
  insights: InsightCard[];
  recommendation: string;
}

export interface InsightsCacheEntry {
  signature: string;
  generated_at: string;
  summary: InsightsSummary;
}

export type InsightsCache = Partial<Record<InsightPeriod, InsightsCacheEntry>>;

export interface CompletionRateResponse {
  total_action_items: number;
  completed: number;
  overdue: number;
  pending: number;
  completion_rate: number;
  avg_completion_days: number | null;
  by_meeting: {
    meeting_id: string;
    meeting_title: string;
    total: number;
    completed: number;
    rate: number;
  }[];
  by_assignee: { name: string; total: number; completed: number; rate: number }[];
  overdue_items: {
    id: string;
    task: string;
    meeting_id: string;
    meeting_title: string;
    due_date: string;
    assignee: string | null;
    days_overdue: number;
  }[];
}
