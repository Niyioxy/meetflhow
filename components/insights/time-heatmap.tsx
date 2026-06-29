"use client";

import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8am-7pm

function formatHour(hour: number): string {
  const period = hour < 12 ? "am" : "pm";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${period}`;
}

export function TimeHeatmap({
  data,
  busiestDay,
  busiestHour,
}: {
  data: { day: number; hour: number; count: number }[];
  busiestDay: string | null;
  busiestHour: string | null;
}) {
  const countByKey = new Map(data.map((d) => [`${d.day}-${d.hour}`, d.count]));
  const maxCount = data.reduce((max, d) => Math.max(max, d.count), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time of day heatmap</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {maxCount === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">No scheduled meetings in this period yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="grid min-w-[480px] grid-cols-[40px_repeat(7,1fr)] gap-1">
                <div />
                {DAY_LABELS.map((label) => (
                  <div key={label} className="text-center text-xs text-muted-foreground">
                    {label}
                  </div>
                ))}
                {HOURS.map((hour) => (
                  <Fragment key={hour}>
                    <div className="text-right text-xs text-muted-foreground">{formatHour(hour)}</div>
                    {DAY_ORDER.map((day) => {
                      const count = countByKey.get(`${day}-${hour}`) ?? 0;
                      const opacity = count === 0 ? 0.04 : Math.max(0.15, count / maxCount);
                      return (
                        <div
                          key={`${day}-${hour}`}
                          title={`${count} meeting${count === 1 ? "" : "s"}`}
                          className="aspect-square rounded-sm"
                          style={{ backgroundColor: `rgba(37, 99, 235, ${opacity})` }}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
            {busiestDay && busiestHour && (
              <p className="text-sm text-muted-foreground">
                Your busiest meeting slot is <span className="font-medium text-foreground">{busiestDay} {busiestHour}</span>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
