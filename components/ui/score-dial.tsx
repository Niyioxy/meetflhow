"use client";

import { useEffect, useState } from "react";

export function scoreColor(score: number) {
  if (score < 50) return "#EF4444";
  if (score < 75) return "#F59E0B";
  return "#10B981";
}

export function ScoreDial({
  score,
  label = "Overall score",
}: {
  score: number;
  label?: string;
}) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(score));
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const radius = 90;
  const arcLength = Math.PI * radius;
  const offset = arcLength * (1 - animated / 100);
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-56">
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          stroke="var(--border-light)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 800ms ease, stroke 800ms ease" }}
        />
      </svg>
      <div className="-mt-9 flex flex-col items-center">
        <span className="text-4xl font-semibold tabular-nums" style={{ color }}>
          {Math.round(animated)}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
