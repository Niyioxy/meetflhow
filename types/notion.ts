export interface NotionIntegrationView {
  connected: boolean;
  workspace_name: string | null;
  workspace_icon: string | null;
  database_id: string | null;
  database_name: string | null;
}

export interface NotionDatabaseView {
  id: string;
  name: string;
}
