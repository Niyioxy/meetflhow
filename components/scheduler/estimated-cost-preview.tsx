"use client";

import { useEffect, useState } from "react";

interface SalaryMatch {
  name: string;
  email: string;
  annual_salary: number;
  currency: string;
}

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NGN: "₦" };

export function EstimatedCostPreview({
  attendees,
  durationMinutes,
}: {
  attendees: string[];
  durationMinutes: number;
}) {
  const [matches, setMatches] = useState<SalaryMatch[]>([]);
  const emailsKey = attendees.join(",");

  useEffect(() => {
    if (attendees.length === 0) {
      setMatches([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/meetings/attendee-salary-lookup?emails=${encodeURIComponent(emailsKey)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setMatches(data.salaries))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailsKey]);

  if (matches.length === 0) return null;

  const currency = matches[0].currency;
  const hours = durationMinutes / 60;
  const total = matches.reduce((sum, m) => sum + (m.annual_salary / 52 / 40) * hours, 0);
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;

  return (
    <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-sm">
      <span className="text-muted-foreground">Estimated cost: </span>
      <span className="font-semibold">
        {symbol}
        {total.toFixed(2)}
      </span>
      <span className="text-xs text-muted-foreground">
        {" "}
        · based on {matches.length} known salar{matches.length === 1 ? "y" : "ies"}
      </span>
    </div>
  );
}
