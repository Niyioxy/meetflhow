"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { AttendeeSalariesModal } from "@/components/meeting/attendee-salaries-modal";
import type { AttendeeSalary, CalculatedCost, CostVerdict } from "@/types/cost";

const VERDICT_STYLES: Record<CostVerdict, { label: string; className: string }> = {
  high_value: {
    label: "High value",
    className: "bg-[rgba(16,185,129,0.1)] text-[#34D399] border-[rgba(16,185,129,0.2)]",
  },
  acceptable: {
    label: "Acceptable",
    className: "bg-[rgba(37,99,235,0.1)] text-[var(--blue-light)] border-[rgba(37,99,235,0.2)]",
  },
  expensive: {
    label: "Expensive",
    className: "bg-[rgba(245,158,11,0.1)] text-[#FBBF24] border-[rgba(245,158,11,0.2)]",
  },
  wasteful: {
    label: "Wasteful",
    className: "bg-[rgba(239,68,68,0.1)] text-[#F87171] border-[rgba(239,68,68,0.2)]",
  },
};

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  NGN: "₦",
};

function formatMoney(amount: number, currency: string) {
  const symbol = CURRENCY_SYMBOL[currency] ?? currency + " ";
  return `${symbol}${amount.toFixed(2)}`;
}

export function MeetingCostCard({
  meetingId,
  durationSeconds,
  initialAttendees,
  initialCost,
  suggestedNames,
}: {
  meetingId: string;
  durationSeconds: number | null;
  initialAttendees: AttendeeSalary[] | null;
  initialCost: CalculatedCost | null;
  suggestedNames: string[];
}) {
  const [attendees, setAttendees] = useState(initialAttendees);
  const [cost, setCost] = useState(initialCost);
  const [recalculating, setRecalculating] = useState(false);

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/calculate-cost`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to calculate cost");
      }
      const data = await res.json();
      setCost(data.calculatedCost);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRecalculating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Meeting Cost</CardTitle>
          <CardDescription>What this meeting actually cost in people&apos;s time</CardDescription>
        </div>
        <AttendeeSalariesModal
          meetingId={meetingId}
          initialAttendees={attendees}
          suggestedNames={suggestedNames}
          onSaved={(newCost) => {
            setAttendees((prev) => prev ?? []);
            setCost(newCost);
          }}
        />
      </CardHeader>
      <CardContent>
        {!attendees || attendees.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Add attendee salaries to see what this meeting cost.
          </p>
        ) : !durationSeconds ? (
          <p className="py-6 text-sm text-muted-foreground">
            This meeting has no recorded duration yet, so cost can&apos;t be calculated.
          </p>
        ) : !cost ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            {recalculating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating...
              </>
            ) : (
              <button className="underline" onClick={handleRecalculate}>
                Calculate cost
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold tabular-nums">
                  {formatMoney(cost.total_cost, cost.currency)}
                </p>
                <p className="text-xs text-muted-foreground">Total cost of this meeting</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {formatMoney(cost.cost_per_minute, cost.currency)} / min
              </Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendee</TableHead>
                  <TableHead>Hourly rate</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cost.breakdown.map((row) => (
                  <TableRow key={row.email}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{formatMoney(row.hourly_rate, cost.currency)}</TableCell>
                    <TableCell className="text-right">{formatMoney(row.cost, cost.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {cost.verdict && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-4">
                <Badge
                  className={cn("self-start font-medium hover:bg-inherit", VERDICT_STYLES[cost.verdict].className)}
                >
                  {VERDICT_STYLES[cost.verdict].label}
                </Badge>
                <p className="text-sm text-muted-foreground">{cost.reasoning}</p>
                {cost.suggestion && (
                  <p className="text-sm italic text-muted-foreground">{cost.suggestion}</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
