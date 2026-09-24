"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreDial, scoreColor } from "@/components/ui/score-dial";
import { SERMON_COACH_RUBRIC } from "@/lib/sermon-coach/rubric";
import {
  sermonCoachDimensionKeys,
  type SermonCoach,
  type SermonCoachEvidence,
  type SermonCoachObservation,
} from "@/types/analysis";

function Evidence({ evidence }: { evidence: SermonCoachEvidence }) {
  return (
    <blockquote className="mt-1 border-l-2 pl-3 text-xs text-muted-foreground">
      {evidence.timestamp && (
        <span className="mr-1.5 font-mono tabular-nums text-foreground/70">{evidence.timestamp}</span>
      )}
      &ldquo;{evidence.excerpt}&rdquo;
    </blockquote>
  );
}

function ObservationList({ title, items }: { title: string; items: SermonCoachObservation[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="flex flex-col gap-3">
        {items.map((item, i) => (
          <li key={i} className="text-sm">
            {item.point}
            <Evidence evidence={item.evidence} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DimensionRow({ label, question, score, insufficientEvidence, summary, evidence }: {
  label: string;
  question: string;
  score: number | null;
  insufficientEvidence: boolean;
  summary: string;
  evidence: SermonCoachEvidence[];
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(score ?? 0));
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <details className="group rounded-md border px-3 py-2">
      <summary className="flex cursor-pointer list-none flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm">
          <span title={question}>{label}</span>
          {insufficientEvidence || score === null ? (
            <span className="text-xs text-muted-foreground">Insufficient evidence</span>
          ) : (
            <span className="font-medium tabular-nums">{score}</span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          {score !== null && (
            <div
              className="h-full rounded-full"
              style={{ width: `${width}%`, background: scoreColor(score), transition: "width 800ms ease" }}
            />
          )}
        </div>
      </summary>
      <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
        {insufficientEvidence ? (
          <p>
            Not scored: the coach couldn&rsquo;t quote the sermon to support a score here, so it&rsquo;s left
            out of the overall score.
          </p>
        ) : (
          <p>{summary}</p>
        )}
        {evidence.map((e, i) => (
          <Evidence key={i} evidence={e} />
        ))}
      </div>
    </details>
  );
}

/**
 * Private preaching feedback — only ever rendered for the meeting's owner
 * (the page decides; the API enforces it too). Separate from the
 * Discussion Guide, which is material for the congregation.
 */
export function SermonCoachCard({
  meetingId,
  initialCoach,
}: {
  meetingId: string;
  initialCoach: SermonCoach | null;
}) {
  const [coach, setCoach] = useState(initialCoach);
  const [loading, setLoading] = useState(!initialCoach);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (coach) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/meetings/${meetingId}/sermon-coach`, { method: "POST" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setCoach(data.sermonCoach);
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
  }, [meetingId, coach]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sermon Coach
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            <Lock className="h-3 w-3" />
            Only visible to you
          </span>
        </CardTitle>
        <CardDescription>
          Feedback on how the sermon communicated — not an assessment of its theology. Every point quotes
          the sermon.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Coaching this sermon... this can take a minute.
          </div>
        ) : failed || !coach ? (
          <p className="py-6 text-sm text-muted-foreground">Sermon coaching is unavailable for this sermon.</p>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
              {coach.overallScore !== null ? (
                <ScoreDial score={coach.overallScore} />
              ) : (
                <p className="max-w-[12rem] text-center text-sm text-muted-foreground">
                  No overall score: none of the dimensions could be backed by quotes from the sermon.
                </p>
              )}
              <div className="flex w-full flex-col gap-2 sm:max-w-sm">
                {sermonCoachDimensionKeys.map((key) => (
                  <DimensionRow
                    key={key}
                    label={SERMON_COACH_RUBRIC[key].label}
                    question={SERMON_COACH_RUBRIC[key].question}
                    {...coach.dimensions[key]}
                  />
                ))}
              </div>
            </div>

            {coach.strongestMoment && (
              <ObservationList title="Strongest moment" items={[coach.strongestMoment]} />
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <ObservationList title="Strengths" items={coach.strengths} />
              <ObservationList title="Improvements" items={coach.improvements} />
            </div>

            <ObservationList title="Unclear or repetitive" items={coach.unclearOrRepetitive} />
            <ObservationList title="Suggested cuts" items={coach.suggestedCuts} />

            {coach.claimsToVerify.length > 0 && (
              <section className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">Claims to double-check</h4>
                <p className="text-xs text-muted-foreground">
                  Statements about passages cited in this sermon that are worth verifying before reuse. These
                  aren&rsquo;t judgements that anything is wrong.
                </p>
                <ul className="flex flex-col gap-3">
                  {coach.claimsToVerify.map((claim, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{claim.passage}:</span> {claim.claim}
                      {claim.reason && <p className="text-xs text-muted-foreground">{claim.reason}</p>}
                      <Evidence evidence={claim.evidence} />
                      <Evidence evidence={claim.passageEvidence} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {coach.tradition && (
              <ObservationList title={`Through a ${coach.tradition} lens`} items={coach.traditionNotes} />
            )}

            {coach.nextSermonFocus && (
              <ObservationList title="Focus for next sermon" items={[coach.nextSermonFocus]} />
            )}

            {!coach.timestampsAvailable && (
              <p className="text-xs text-muted-foreground">
                No timestamps: this sermon came from a pasted transcript, so quotes are shown without times.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
