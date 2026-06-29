"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export function HoursBarChart({ data }: { data: { date: string; hours: number }[] }) {
  const average =
    data.length > 0 ? data.reduce((sum, d) => sum + d.hours, 0) / data.length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hours per day</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          {data.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No meetings in this period yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => format(new Date(v), "MMM d")}
                  stroke="var(--text-secondary)"
                  fontSize={12}
                />
                <YAxis stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip
                  labelFormatter={(v) => format(new Date(v), "MMM d, yyyy")}
                  formatter={(value) => [`${Number(value).toFixed(1)}h`, "Hours"]}
                />
                <ReferenceLine
                  y={average}
                  stroke="var(--amber)"
                  strokeDasharray="4 4"
                  label={{ value: "avg", fill: "var(--amber)", fontSize: 11, position: "right" }}
                />
                <Bar dataKey="hours" fill="var(--blue-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
