"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Loader2, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { SermonInsights } from "@/lib/sermon-insights";

export function SermonInsightsCard() {
  const [insights, setInsights] = useState<SermonInsights | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/insights/sermons")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setInsights(data.insights))
      .catch(() => setInsights(null));
  }, []);

  // Loading and "never recorded a sermon" are different states — undefined
  // shows a spinner, null renders nothing at all so this doesn't clutter
  // the page for the vast majority of accounts that never touch sermons.
  if (insights === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sermon insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sermon insights...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights === null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sermon insights</CardTitle>
        <CardDescription>
          {insights.sermonCount} sermon{insights.sermonCount === 1 ? "" : "s"} preached ·{" "}
          {insights.totalHours}h total
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {insights.topScriptures.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Most referenced scripture</p>
            <div className="flex flex-wrap gap-2">
              {insights.topScriptures.map((s) => (
                <span
                  key={s.reference}
                  className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
                >
                  <BookOpen className="h-3 w-3 text-muted-foreground" />
                  {s.reference}
                  <span className="text-muted-foreground">×{s.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {insights.recentThemes.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Recent themes</p>
            <div className="flex flex-col gap-2">
              {insights.recentThemes.map((sermon) => (
                <Link
                  key={sermon.id}
                  href={`/meetings/${sermon.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                >
                  <span>{sermon.theme}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(new Date(sermon.createdAt), "MMM d, yyyy")}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
