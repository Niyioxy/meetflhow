"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PLATFORM_COLOR: Record<string, string> = {
  "google-meet": "#10B981",
  "google meet": "#10B981",
  teams: "#A855F7",
  "microsoft teams": "#A855F7",
  zoom: "#2563EB",
};
const DEFAULT_COLOR = "#94A3B8";

export function PlatformDonutChart({ data }: { data: { platform: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meetings by platform</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-64 w-full">
          {data.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No meetings in this period yet.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="platform"
                    innerRadius="60%"
                    outerRadius="85%"
                    paddingAngle={2}
                    isAnimationActive
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.platform}
                        fill={PLATFORM_COLOR[entry.platform.toLowerCase()] ?? DEFAULT_COLOR}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} meetings`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums">{total}</span>
                <span className="text-xs text-muted-foreground">meetings</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
