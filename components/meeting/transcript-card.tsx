"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { initialsFromName, colorFromName } from "@/lib/avatar";
import type { SpeakerSegment } from "@/types/analysis";

type ViewMode = "speaker" | "full";

export function TranscriptCard({
  meetingId,
  fullText,
  wordCount,
  language,
  initialSegments,
}: {
  meetingId: string;
  fullText: string;
  wordCount: number;
  language: string | null;
  initialSegments: SpeakerSegment[] | null;
}) {
  const [segments, setSegments] = useState(initialSegments);
  const [loadingSegments, setLoadingSegments] = useState(!initialSegments);
  const [mode, setMode] = useState<ViewMode>("full");

  useEffect(() => {
    if (segments) return;
    let cancelled = false;
    setLoadingSegments(true);
    fetch(`/api/meetings/${meetingId}/identify-speakers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendees: [] }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setSegments(data.speakerSegments);
      })
      .catch(() => {
        if (!cancelled) setSegments([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSegments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId, segments]);

  const talkTime = useMemo(() => {
    if (!segments || segments.length === 0) return [];
    const totalChars = segments.reduce((sum, s) => sum + s.text.length, 0);
    const bySpeaker = new Map<string, number>();
    for (const s of segments) {
      bySpeaker.set(s.speaker, (bySpeaker.get(s.speaker) ?? 0) + s.text.length);
    }
    return Array.from(bySpeaker.entries())
      .map(([speaker, chars]) => ({
        speaker,
        pct: totalChars > 0 ? (chars / totalChars) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [segments]);

  const hasSegments = Boolean(segments && segments.length > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Transcript</CardTitle>
        <div className="flex items-center gap-2">
          {loadingSegments && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Identifying speakers...
            </span>
          )}
          {hasSegments && (
            <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1">
              <Button
                type="button"
                variant={mode === "speaker" ? "default" : "ghost"}
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setMode("speaker")}
              >
                By speaker
              </Button>
              <Button
                type="button"
                variant={mode === "full" ? "default" : "ghost"}
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setMode("full")}
              >
                Full transcript
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {hasSegments && (
          <div className="flex flex-col gap-2">
            <div className="flex h-2 w-full overflow-hidden rounded-full">
              {talkTime.map((t) => (
                <div
                  key={t.speaker}
                  style={{ width: `${t.pct}%`, backgroundColor: colorFromName(t.speaker) }}
                  title={`${t.speaker}: ${Math.round(t.pct)}%`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {talkTime.map((t) => (
                <span key={t.speaker} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: colorFromName(t.speaker) }}
                  />
                  {t.speaker} · {Math.round(t.pct)}%
                </span>
              ))}
            </div>
          </div>
        )}

        {mode === "speaker" && hasSegments ? (
          <div className="flex max-h-96 flex-col gap-4 overflow-y-auto rounded-md bg-muted/30 p-4">
            {segments!.map((seg, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: colorFromName(seg.speaker) }}
                >
                  {initialsFromName(seg.speaker)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{seg.speaker}</span>
                    <span className="text-xs text-muted-foreground">{seg.timestamp_approx}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{seg.text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/30 p-4 text-sm leading-relaxed">
            {fullText}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {wordCount} words
          {language ? ` · ${language}` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
