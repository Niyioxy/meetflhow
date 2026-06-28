import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority } from "@/db/schema";

const CONFIG: Record<Priority, string> = {
  high: "bg-[rgba(239,68,68,0.1)] text-[#F87171] border-[rgba(239,68,68,0.2)]",
  medium: "bg-[rgba(245,158,11,0.1)] text-[#FCD34D] border-[rgba(245,158,11,0.2)]",
  low: "bg-[rgba(16,185,129,0.1)] text-[#34D399] border-[rgba(16,185,129,0.2)]",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge className={cn("font-medium capitalize", CONFIG[priority])}>{priority}</Badge>
  );
}
