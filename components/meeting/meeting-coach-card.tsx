"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type { MeetingCoachScore } from "@/types/analysis";

function scoreColor(score: number) {
  if (score < 50) return "#EF4444";
  if (score < 75) return "#F59E0B";
  return "#10B981";
}

function ScoreDial({ score }: { score: number }) {
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
        <span className="text-xs text-muted-foreground">Overall score</span>
      </div>
    </div>
  );
}

function AnimatedBar({ label, value }: { label: string; value: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(value));
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${width}%`, transition: "width 800ms ease" }}
        />
      </div>
    </div>
  );
}

export function MeetingCoachCard({
  meetingId,
  initialScore,
}: {
  meetingId: string;
  initialScore: MeetingCoachScore | null;
}) {
  const [score, setScore] = useState(initialScore);
  const [loading, setLoading] = useState(!initialScore);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (score) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/meetings/${meetingId}/coach`, { method: "POST" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setScore(data.meetingScore);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId, score]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meeting Coach</CardTitle>
        <CardDescription>AI-scored balance, decisiveness, and clarity</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Coaching this meeting...
          </div>
        ) : failed || !score ? (
          <p className="py-6 text-sm text-muted-foreground">
            Coach analysis is unavailable for this meeting.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
              <ScoreDial score={score.overall_score} />
              <div className="flex w-full flex-col gap-4 sm:max-w-xs">
                <AnimatedBar label="Talk Time" value={score.talk_time_ratio} />
                <AnimatedBar label="Decision Rate" value={score.decision_rate} />
                <AnimatedBar label="Clarity" value={score.clarity_score} />
              </div>
            </div>

            <p className="text-sm italic text-muted-foreground">{score.coach_feedback}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">✅ Strengths</h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {score.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">⚡ Improvements</h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {score.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
