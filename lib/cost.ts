import { createHash } from "crypto";
import type { AttendeeSalary, CostBreakdownRow } from "@/types/cost";

export function computeCostSignature(attendees: AttendeeSalary[], durationSeconds: number): string {
  const payload = JSON.stringify({
    durationSeconds,
    attendees: attendees.map((a) => ({ email: a.email, salary: a.annual_salary, currency: a.currency })),
  });
  return createHash("sha256").update(payload).digest("hex");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateMeetingCost(attendees: AttendeeSalary[], durationSeconds: number) {
  const currency = attendees[0]?.currency ?? "GBP";
  const durationHours = durationSeconds / 3600;

  const breakdown: CostBreakdownRow[] = attendees.map((a) => {
    const hourlyRate = a.annual_salary / 52 / 40;
    const cost = hourlyRate * durationHours;
    return { name: a.name, email: a.email, hourly_rate: round2(hourlyRate), cost: round2(cost) };
  });

  const totalCost = round2(breakdown.reduce((sum, b) => sum + b.cost, 0));
  const durationMinutes = durationSeconds / 60;
  const costPerMinute = durationMinutes > 0 ? round2(totalCost / durationMinutes) : 0;

  return {
    total_cost: totalCost,
    currency,
    cost_per_minute: costPerMinute,
    breakdown,
    signature: computeCostSignature(attendees, durationSeconds),
  };
}
