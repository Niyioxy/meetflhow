"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, DollarSign, ClipboardList, Star } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { PeriodFilter } from "@/components/insights/period-filter";
import { HoursBarChart } from "@/components/insights/hours-bar-chart";
import { PlatformDonutChart } from "@/components/insights/platform-donut-chart";
import { ScoreTrendChart } from "@/components/insights/score-trend-chart";
import { InsightSummaryCards } from "@/components/insights/insight-summary-cards";
import { TimeHeatmap } from "@/components/insights/time-heatmap";
import { ActionItemHealth } from "@/components/insights/action-item-health";
import type { InsightPeriod, InsightsResponse, InsightsSummary } from "@/types/insights";

type InsightsApiResponse = InsightsResponse & { summary: InsightsSummary | null };

function formatChange(value: number | null): { value: string; direction: "up" | "down" } | undefined {
  if (value == null) return undefined;
  return { value: `${value > 0 ? "+" : ""}${value}% vs last period`, direction: value >= 0 ? "up" : "down" };
}

export default function InsightsPage() {
  const [period, setPeriod] = useState<InsightPeriod>("week");
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<InsightsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (customRange) {
      params.set("from", new Date(customRange.from).toISOString());
      params.set("to", new Date(customRange.to).toISOString());
    }
    fetch(`/api/insights?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period, customRange]);

  const completionPeriod = period === "quarter" ? "month" : period;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">Trends across your meetings over time.</p>
        </div>
        <PeriodFilter
          period={period}
          onPeriodChange={(p) => {
            setCustomRange(null);
            setPeriod(p);
          }}
          onCustomRange={(from, to) => setCustomRange({ from, to })}
        />
      </div>

      {loading || !data ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading insights...
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total meeting hours"
              value={`${data.total_hours}h`}
              icon={Clock}
              trend={formatChange(data.changes.total_hours)}
            />
            <StatCard
              label="Total meeting cost"
              value={`£${data.total_cost.toFixed(2)}`}
              icon={DollarSign}
              trend={formatChange(data.changes.total_cost)}
            />
            <StatCard
              label="Meetings held"
              value={data.total_meetings}
              icon={ClipboardList}
              trend={formatChange(data.changes.total_meetings)}
            />
            <StatCard
              label="Avg meeting score"
              value={data.avg_meeting_score != null ? Math.round(data.avg_meeting_score) : "—"}
              icon={Star}
              trend={formatChange(data.changes.avg_meeting_score)}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <HoursBarChart data={data.hours_per_day} />
            <PlatformDonutChart data={data.meetings_per_platform} />
          </div>

          <ScoreTrendChart data={data.score_trend} trend={data.time_trend} />

          <InsightSummaryCards summary={data.summary} />

          <TimeHeatmap data={data.heatmap} busiestDay={data.busiest_day} busiestHour={data.busiest_hour} />

          <ActionItemHealth period={completionPeriod} />
        </>
      )}
    </div>
  );
}
