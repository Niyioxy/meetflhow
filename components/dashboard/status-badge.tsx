import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MeetingStatus } from "@/db/schema";
import { Loader2 } from "lucide-react";

const STATUS_LABEL: Record<MeetingStatus, string> = {
  uploading: "Uploading",
  transcribing: "Transcribing",
  analyzing: "Analyzing",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_CLASS: Record<MeetingStatus, string> = {
  uploading: "bg-[rgba(37,99,235,0.1)] text-[#60A5FA] border-[rgba(37,99,235,0.2)]",
  transcribing: "bg-[rgba(245,158,11,0.1)] text-[#FCD34D] border-[rgba(245,158,11,0.2)]",
  analyzing: "bg-[rgba(245,158,11,0.1)] text-[#FCD34D] border-[rgba(245,158,11,0.2)]",
  ready: "bg-[rgba(16,185,129,0.1)] text-[#34D399] border-[rgba(16,185,129,0.2)]",
  failed: "bg-[rgba(239,68,68,0.1)] text-[#F87171] border-[rgba(239,68,68,0.2)]",
};

const IN_PROGRESS: MeetingStatus[] = ["uploading", "transcribing", "analyzing"];

export function StatusBadge({ status }: { status: MeetingStatus }) {
  return (
    <Badge className={cn("gap-1 font-medium", STATUS_CLASS[status])}>
      {IN_PROGRESS.includes(status) && <Loader2 className="h-3 w-3 animate-spin" />}
      {STATUS_LABEL[status]}
    </Badge>
  );
}
