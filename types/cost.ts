export const currencyEnum = ["GBP", "USD", "EUR", "NGN"] as const;
export type Currency = (typeof currencyEnum)[number];

export interface AttendeeSalary {
  name: string;
  email: string;
  annual_salary: number;
  currency: Currency;
}

export type CostVerdict = "high_value" | "acceptable" | "expensive" | "wasteful";

export interface CostBreakdownRow {
  name: string;
  email: string;
  hourly_rate: number;
  cost: number;
}

export interface CalculatedCost {
  total_cost: number;
  currency: Currency;
  cost_per_minute: number;
  breakdown: CostBreakdownRow[];
  verdict: CostVerdict | null;
  reasoning: string | null;
  suggestion: string | null;
  /** Hash of the inputs (salaries + duration) used to avoid re-calling Gemini when nothing changed. */
  signature: string;
}
