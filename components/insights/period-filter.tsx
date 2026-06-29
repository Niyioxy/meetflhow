"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InsightPeriod } from "@/types/insights";

const OPTIONS: { value: InsightPeriod; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
];

export function PeriodFilter({
  period,
  onPeriodChange,
  onCustomRange,
}: {
  period: InsightPeriod;
  onPeriodChange: (period: InsightPeriod) => void;
  onCustomRange: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
        {OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={period === opt.value ? "default" : "ghost"}
            size="sm"
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => onPeriodChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-36" />
        <span>to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-36" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={!from || !to}
          onClick={() => onCustomRange(from, to)}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
