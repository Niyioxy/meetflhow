"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScoreDial } from "@/components/ui/score-dial";
import { initialsFromName, colorFromName } from "@/lib/avatar";
import type { CompletionRateResponse } from "@/types/insights";

export function ActionItemHealth({ period }: { period: "week" | "month" }) {
  const [data, setData] = useState<CompletionRateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [reassignValue, setReassignValue] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analytics/completion-rate?period=${period}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  function removeOverdue(id: string) {
    setData((prev) =>
      prev ? { ...prev, overdue_items: prev.overdue_items.filter((i) => i.id !== id) } : prev
    );
  }

  async function markComplete(id: string) {
    try {
      const res = await fetch(`/api/action-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!res.ok) throw new Error();
      removeOverdue(id);
      toast.success("Marked complete");
    } catch {
      toast.error("Failed to update action item");
    }
  }

  async function dismiss(id: string) {
    try {
      const res = await fetch(`/api/action-items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      removeOverdue(id);
    } catch {
      toast.error("Failed to dismiss action item");
    }
  }

  async function saveReassign(id: string) {
    const owner = reassignValue.trim() || null;
    try {
      const res = await fetch(`/api/action-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner }),
      });
      if (!res.ok) throw new Error();
      setData((prev) =>
        prev
          ? {
              ...prev,
              overdue_items: prev.overdue_items.map((i) => (i.id === id ? { ...i, assignee: owner } : i)),
            }
          : prev
      );
      toast.success("Reassigned");
    } catch {
      toast.error("Failed to reassign");
    } finally {
      setReassigningId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Action Item Health</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total_action_items === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Action Item Health</CardTitle>
          <CardDescription>No action items generated in this period yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold tracking-tight">Action Item Health</h2>

      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-6 sm:flex-row sm:justify-around">
          <div className="flex flex-col items-center">
            <ScoreDial score={data.completion_rate} label="Completion rate" />
            <p className="text-sm text-muted-foreground">
              {data.completed} of {data.total_action_items} tasks completed
            </p>
          </div>
          <div className="flex gap-3">
            <Chip label="Completed" value={data.completed} color="#10B981" emoji="✅" />
            <Chip label="Overdue" value={data.overdue} color="#EF4444" emoji="⏰" />
            <Chip label="Pending" value={data.pending} color="#F59E0B" emoji="⏳" />
          </div>
        </CardContent>
      </Card>

      {data.by_meeting.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By meeting</CardTitle>
            <CardDescription>Worst completion rate first</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.by_meeting.map((row) => (
              <Link
                key={row.meeting_id}
                href={`/meetings/${row.meeting_id}`}
                className="flex items-center gap-3 rounded-md p-2 text-sm hover:bg-muted/40"
              >
                <span className="flex-1 truncate font-medium">{row.meeting_title}</span>
                <span className="text-xs text-muted-foreground">
                  {row.completed}/{row.total}
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${row.rate}%`,
                      backgroundColor: row.rate < 50 ? "#EF4444" : row.rate < 75 ? "#F59E0B" : "#10B981",
                    }}
                  />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{row.rate}%</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {data.by_assignee.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By assignee</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.by_assignee.map((row) => (
              <div key={row.name} className="flex items-center gap-3 text-sm">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: colorFromName(row.name) }}
                >
                  {initialsFromName(row.name)}
                </div>
                <span className="flex-1 truncate font-medium">{row.name}</span>
                <span className="text-xs text-muted-foreground">
                  {row.completed}/{row.total}
                </span>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{row.rate}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.overdue_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Overdue items</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.overdue_items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border-l-4 border-l-[#EF4444] bg-[rgba(239,68,68,0.05)] p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{item.task}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.meeting_title} · due {new Date(item.due_date).toLocaleDateString()} ·{" "}
                    {item.days_overdue} day{item.days_overdue === 1 ? "" : "s"} overdue
                    {item.assignee ? ` · ${item.assignee}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {reassigningId === item.id ? (
                    <>
                      <Input
                        autoFocus
                        value={reassignValue}
                        onChange={(e) => setReassignValue(e.target.value)}
                        placeholder="Assignee name"
                        className="h-8 w-36"
                      />
                      <Button size="icon-sm" variant="ghost" onClick={() => saveReassign(item.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => setReassigningId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => markComplete(item.id)}>
                        Mark complete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReassigningId(item.id);
                          setReassignValue(item.assignee ?? "");
                        }}
                      >
                        Reassign
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dismiss(item.id)}>
                        Dismiss
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Chip({ label, value, color, emoji }: { label: string; value: number; color: string; emoji: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-border px-4 py-2">
      <span className="text-xs text-muted-foreground">
        {emoji} {label}
      </span>
      <span className="text-xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
