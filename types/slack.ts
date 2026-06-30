export interface SlackIntegrationView {
  connected: boolean;
  team_name: string | null;
  default_channel_id: string | null;
  default_channel_name: string | null;
  auto_post_summary: boolean;
  auto_post_action_items: boolean;
}

export interface SlackChannelView {
  id: string;
  name: string;
}
