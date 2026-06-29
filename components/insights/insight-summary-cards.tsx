import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InsightCardType, InsightsSummary } from "@/types/insights";

const TYPE_CONFIG: Record<InsightCardType, { icon: string; className: string }> = {
  warning: { icon: "⚠️", className: "border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)]" },
  tip: { icon: "💡", className: "border-[rgba(37,99,235,0.3)] bg-[rgba(37,99,235,0.06)]" },
  win: { icon: "🏆", className: "border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.06)]" },
};

export function InsightSummaryCards({ summary }: { summary: InsightsSummary | null }) {
  if (!summary) return null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{summary.headline}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.insights.map((insight, i) => {
          const config = TYPE_CONFIG[insight.type];
          return (
            <Card key={i} className={cn("border", config.className)}>
              <CardContent className="flex flex-col gap-1.5 py-4">
                <p className="text-sm font-medium">
                  {config.icon} {insight.title}
                </p>
                <p className="text-sm text-muted-foreground">{insight.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-sm italic text-muted-foreground">{summary.recommendation}</p>
    </div>
  );
}
