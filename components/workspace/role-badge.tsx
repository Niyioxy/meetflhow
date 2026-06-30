import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/db/schema";

const CONFIG: Record<WorkspaceRole, string> = {
  owner: "bg-[rgba(245,158,11,0.12)] text-[#D97706] border-[rgba(245,158,11,0.25)]",
  admin: "bg-[rgba(37,99,235,0.1)] text-[#60A5FA] border-[rgba(37,99,235,0.2)]",
  member: "bg-[rgba(148,163,184,0.12)] text-[var(--text-secondary)] border-[rgba(148,163,184,0.2)]",
  viewer: "bg-[rgba(100,116,139,0.12)] text-[#94A3B8] border-[rgba(100,116,139,0.2)]",
};

export function RoleBadge({ role }: { role: WorkspaceRole }) {
  return <Badge className={cn("font-medium capitalize", CONFIG[role])}>{role}</Badge>;
}
