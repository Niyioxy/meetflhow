import type { WorkspaceRole, WorkspacePlan } from "@/db/schema";

export type { WorkspaceRole, WorkspacePlan };

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  plan: WorkspacePlan;
  avatar_color: string | null;
  role: WorkspaceRole;
}

export interface WorkspaceMemberView {
  id: string;
  user_id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: WorkspaceRole;
  joined_at: string;
}

export interface WorkspaceInviteView {
  id: string;
  email: string;
  role: WorkspaceRole;
  expires_at: string | null;
  created_at: string;
}

export interface WorkspaceDetail extends WorkspaceSummary {
  owner_id: string;
  members: WorkspaceMemberView[];
  pending_invites: WorkspaceInviteView[];
}

export interface InvitePreview {
  workspace_name: string;
  inviter_name: string | null;
  role: WorkspaceRole;
  expired: boolean;
  already_accepted: boolean;
}
