import type { WebhookEvent, WebhookStatus } from "@/db/schema";

export type { WebhookEvent, WebhookStatus };

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  "meeting.completed": "Meeting completed",
  "action_item.created": "Action item created",
  "action_item.completed": "Action item completed",
  "meeting.scored": "Meeting scored",
  "task.created": "Task created",
  "todo.created": "Todo created",
};

export interface WebhookView {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  is_active: boolean;
  last_triggered_at: string | null;
  last_status: WebhookStatus | null;
  created_at: string;
  secret?: string;
}

export interface WebhookLogView {
  id: string;
  event: WebhookEvent;
  success: boolean;
  response_status: number | null;
  created_at: string;
}
