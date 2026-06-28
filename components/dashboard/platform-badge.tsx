import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PLATFORM_CLASS: Record<string, string> = {
  "google-meet": "bg-[rgba(16,185,129,0.1)] text-[#34D399] border-[rgba(16,185,129,0.2)]",
  "google meet": "bg-[rgba(16,185,129,0.1)] text-[#34D399] border-[rgba(16,185,129,0.2)]",
  teams: "bg-[rgba(168,85,247,0.1)] text-[#C084FC] border-[rgba(168,85,247,0.2)]",
  "microsoft teams": "bg-[rgba(168,85,247,0.1)] text-[#C084FC] border-[rgba(168,85,247,0.2)]",
  zoom: "bg-[rgba(37,99,235,0.1)] text-[#60A5FA] border-[rgba(37,99,235,0.2)]",
};

const DEFAULT_CLASS = "bg-[rgba(148,163,184,0.1)] text-[var(--text-secondary)] border-[rgba(148,163,184,0.2)]";

export function PlatformBadge({ platform, className }: { platform: string; className?: string }) {
  const key = platform.trim().toLowerCase();
  return (
    <Badge className={cn("font-medium capitalize", PLATFORM_CLASS[key] ?? DEFAULT_CLASS, className)}>
      {platform}
    </Badge>
  );
}
