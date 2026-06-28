import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Sentiment } from "@/db/schema";
import { Smile, Meh, Frown } from "lucide-react";

const CONFIG: Record<Sentiment, { label: string; className: string; icon: typeof Smile }> = {
  positive: {
    label: "Positive",
    className: "bg-[rgba(16,185,129,0.1)] text-[#34D399] border-[rgba(16,185,129,0.2)]",
    icon: Smile,
  },
  neutral: {
    label: "Neutral",
    className: "bg-[rgba(148,163,184,0.1)] text-[var(--text-secondary)] border-[rgba(148,163,184,0.2)]",
    icon: Meh,
  },
  tense: {
    label: "Tense",
    className: "bg-[rgba(239,68,68,0.1)] text-[#F87171] border-[rgba(239,68,68,0.2)]",
    icon: Frown,
  },
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const { label, className, icon: Icon } = CONFIG[sentiment];
  return (
    <Badge className={cn("gap-1 font-medium hover:bg-inherit", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
