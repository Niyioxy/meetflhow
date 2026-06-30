import type { WebhookEvent } from "@/db/schema";

/** Pure helpers safe to import from client components — no server-only db client. */

export function buildSamplePayload(event: WebhookEvent): object {
  switch (event) {
    case "meeting.completed":
      return {
        meeting_id: "00000000-0000-0000-0000-000000000000",
        title: "Q3 Planning Sync",
        platform: "Google Meet",
        duration_seconds: 1800,
        summary: "The team aligned on Q3 priorities and assigned owners for each workstream.",
        url: "https://meetflhow.app/meetings/00000000-0000-0000-0000-000000000000",
      };
    case "meeting.scored":
      return {
        meeting_id: "00000000-0000-0000-0000-000000000000",
        title: "Q3 Planning Sync",
        overall_score: 82,
      };
    case "action_item.created":
    case "action_item.completed":
      return {
        action_item_id: "00000000-0000-0000-0000-000000000000",
        task: "Send updated proposal to client",
        owner: "Jamie Rivera",
        due_date: "2026-07-15",
        meeting_id: "00000000-0000-0000-0000-000000000000",
      };
    case "task.created":
      return {
        task_id: "00000000-0000-0000-0000-000000000000",
        title: "Follow up on contract terms",
        priority: "high",
        status: "backlog",
      };
    case "todo.created":
      return {
        todo_id: "00000000-0000-0000-0000-000000000000",
        title: "Review onboarding doc",
        priority: "medium",
      };
  }
}

export function isValidWebhookUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
