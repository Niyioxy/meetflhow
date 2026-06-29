"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import type { InsightsResponse } from "@/types/insights";

const TREND_COLOR: Record<InsightsResponse["time_trend"], string> = {
  improving: "#10B981",
  stable: "var(--blue-primary)",
  worsening: "#EF4444",
};

interface TooltipPoint {
  date: string;
  title: string;
  score: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: TooltipPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="max-w-56 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-[var(--shadow-card)]">
      <p className="font-medium text-foreground">{point.title}</p>
      <p className="mt-1 text-muted-foreground">
        {format(new Date(point.date), "MMM d, yyyy")} · score {point.score}
      </p>
    </div>
  );
}

export function ScoreTrendChart({
  data,
  trend,
}: {
  data: InsightsResponse["score_trend"];
  trend: InsightsResponse["time_trend"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Meeting score trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          {data.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No scored meetings in this period yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => format(new Date(v), "MMM d")}
                  stroke="var(--text-secondary)"
                  fontSize={12}
                />
                <YAxis domain={[0, 100]} stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={75}
                  stroke="var(--text-muted)"
                  strokeDasharray="4 4"
                  label={{ value: "good", fill: "var(--text-muted)", fontSize: 11, position: "right" }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={TREND_COLOR[trend]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
