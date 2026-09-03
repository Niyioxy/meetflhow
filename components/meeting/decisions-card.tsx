"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Loader2, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Citation {
  meetingId: string;
  title: string;
  createdAt: string;
}

interface ProvenanceState {
  loading: boolean;
  narrative: string | null;
  citations: Citation[];
  failed: boolean;
}

/**
 * Each decision expands into "how did we get here" — a short AI narrative
 * plus links to the earlier meetings it was traced back to, generated
 * on-demand per decision (not eagerly for all of them) against the same
 * embedding index "Ask your meetings" already searches.
 */
export function DecisionsCard({
  meetingId,
  title,
  decisions,
}: {
  meetingId: string;
  title: string;
  decisions: string[];
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [provenance, setProvenance] = useState<Record<number, ProvenanceState>>({});

  async function handleToggle(index: number, decisionText: string) {
    if (expandedIndex === index) {
      setExpandedIndex(null);
      return;
    }
    setExpandedIndex(index);
    if (provenance[index]) return;

    setProvenance((prev) => ({
      ...prev,
      [index]: { loading: true, narrative: null, citations: [], failed: false },
    }));
    try {
      const res = await fetch(`/api/meetings/${meetingId}/decisions/provenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionText }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProvenance((prev) => ({
        ...prev,
        [index]: { loading: false, narrative: data.narrative, citations: data.citations, failed: false },
      }));
    } catch {
      setProvenance((prev) => ({
        ...prev,
        [index]: { loading: false, narrative: null, citations: [], failed: true },
      }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        {decisions.map((decision, i) => {
          const state = provenance[i];
          const isOpen = expandedIndex === i;
          return (
            <div key={i} className="border-b border-border last:border-0">
              <button
                type="button"
                onClick={() => handleToggle(i, decision)}
                className="flex w-full items-start gap-2 rounded py-2 text-left text-sm hover:bg-muted/40"
              >
                {isOpen ? (
                  <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span>{decision}</span>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-2 py-1 pb-3 pl-9 text-xs">
                  {!state || state.loading ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Tracing how this decision came about...
                    </span>
                  ) : state.failed ? (
                    <span className="text-muted-foreground">Couldn&apos;t trace this decision.</span>
                  ) : (
                    <>
                      <p className="flex items-start gap-1.5 text-muted-foreground">
                        <History className="mt-0.5 h-3 w-3 shrink-0" />
                        {state.narrative}
                      </p>
                      {state.citations.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 pl-[18px]">
                          {state.citations.map((c) => (
                            <Link
                              key={c.meetingId}
                              href={`/meetings/${c.meetingId}`}
                              className="text-primary hover:underline"
                            >
                              {c.title} — {new Date(c.createdAt).toLocaleDateString()}
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
