import type { IssueTrackerProvider } from "@/db/schema";

export type { IssueTrackerProvider };

export interface IssueTrackerIntegrationView {
  provider: IssueTrackerProvider;
  connected: boolean;
  site_name: string | null;
  default_project_id: string | null;
  default_project_name: string | null;
}

export interface ProjectView {
  id: string;
  name: string;
  key?: string;
}

export interface CreatedTicket {
  ticket_id: string;
  ticket_url: string;
  provider: IssueTrackerProvider;
}
