"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { RecurringMeetingGroup } from "@/lib/zombie-meetings";

export function RecurringMeetingsCard() {
  const [groups, setGroups] = useState<RecurringMeetingGroup[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/insights/recurring-meetings")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setGroups(data.groups))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recurring meetings</CardTitle>
        <CardDescription>
          Meetings with the same title, run 3+ times — flagged when they&apos;ve produced zero
          decisions across all of them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking for recurring meetings...
          </div>
        ) : !groups || groups.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No recurring meetings detected yet — a series needs the same title 3+ times to show up
            here.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div
                key={group.title}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium">{group.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.occurrences} occurrences · last{" "}
                    {formatDistanceToNow(new Date(group.lastOccurredAt), { addSuffix: true })}
                    {group.totalCost !== null && ` · ${group.currency ?? ""} ${group.totalCost} total`}
                  </p>
                </div>
                {group.isZombie ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    Zero decisions
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                    {group.totalDecisions} decision{group.totalDecisions === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
