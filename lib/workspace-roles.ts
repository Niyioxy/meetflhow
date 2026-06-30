import type { WorkspaceRole } from "@/db/schema";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export function roleAtLeast(role: WorkspaceRole, minRole: WorkspaceRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
