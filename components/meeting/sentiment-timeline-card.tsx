"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { SentimentTimeline } from "@/types/analysis";

interface ChartPoint {
  percent: number;
  score: number;
  key_moment: string;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="max-w-56 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-[var(--shadow-card)]">
      <p className="font-medium text-foreground">
        {point.percent}% · score {point.score}
      </p>
      <p className="mt-1 text-muted-foreground">{point.key_moment}</p>
    </div>
  );
}

export function SentimentTimelineCard({
  meetingId,
  initialTimeline,
}: {
  meetingId: string;
  initialTimeline: SentimentTimeline | null;
}) {
  const [timeline, setTimeline] = useState(initialTimeline);
  const [loading, setLoading] = useState(!initialTimeline);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (timeline) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/meetings/${meetingId}/sentiment`, { method: "POST" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setTimeline(data.sentimentTimeline);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId, timeline]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentiment Timeline</CardTitle>
        <CardDescription>Emotional tone and energy across the meeting</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Mapping sentiment...
          </div>
        ) : failed || !timeline ? (
          <p className="py-6 text-sm text-muted-foreground">
            Sentiment timeline is unavailable for this meeting.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timeline.segments.map((s) => ({ ...s, percent: s.segment * 10 }))}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.6} />
                      <stop offset="50%" stopColor="#94A3B8" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis
                    dataKey="percent"
                    tickFormatter={(v) => `${v}%`}
                    stroke="var(--text-secondary)"
                    fontSize={12}
                  />
                  <YAxis domain={[-100, 100]} stroke="var(--text-secondary)" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="var(--blue-primary)"
                    strokeWidth={2}
                    fill="url(#sentimentGradient)"
                    isAnimationActive
                    animationDuration={1000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[rgba(16,185,129,0.2)] bg-[rgba(16,185,129,0.1)] px-3 py-1 text-[#34D399]">
                🟢 {timeline.most_positive_moment}
              </span>
              <span className="rounded-full border border-[rgba(239,68,68,0.2)] bg-[rgba(239,68,68,0.1)] px-3 py-1 text-[#F87171]">
                🔴 {timeline.most_tense_moment}
              </span>
              <span className="rounded-full border border-[rgba(148,163,184,0.2)] bg-[rgba(148,163,184,0.1)] px-3 py-1 text-[var(--text-secondary)]">
                😐 {timeline.overall_sentiment}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
