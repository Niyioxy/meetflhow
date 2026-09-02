"use client";

import { useEffect, useState } from "react";
import { Loader2, BookOpen, Quote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { VerticalContent } from "@/types/analysis";

export function VerticalContentCard({
  meetingId,
  initialContent,
}: {
  meetingId: string;
  initialContent: VerticalContent | null;
}) {
  const [content, setContent] = useState(initialContent);
  const [loading, setLoading] = useState(!initialContent);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (content) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/meetings/${meetingId}/vertical-content`, { method: "POST" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setContent(data.verticalContent);
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
  }, [meetingId, content]);

  const title = content?.kind === "podcast_notes" ? "Show notes" : "Discussion guide";
  const description =
    content?.kind === "podcast_notes"
      ? "Episode outline and pull-quotes, ready to paste into your show notes."
      : "Small-group discussion questions generated from this sermon.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Writing {title.toLowerCase()}...
          </div>
        ) : failed || !content ? (
          <p className="py-6 text-sm text-muted-foreground">
            Couldn&apos;t generate this — try again from the meeting later.
          </p>
        ) : content.kind === "sermon_guide" ? (
          <div className="flex flex-col gap-5">
            <p className="text-sm font-medium">{content.centralTheme}</p>

            {content.scriptureReferences.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {content.scriptureReferences.map((ref) => (
                  <span
                    key={ref}
                    className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium"
                  >
                    <BookOpen className="h-3 w-3" />
                    {ref}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">Discussion questions</h4>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
                {content.discussionQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">{content.episodeSummary}</p>

            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-medium">Chapters</h4>
              <ol className="flex flex-col gap-3">
                {content.chapters.map((chapter, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
                    <div>
                      <p className="font-medium">{chapter.title}</p>
                      <p className="text-muted-foreground">{chapter.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {content.pullQuotes.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-medium">Pull-quotes</h4>
                {content.pullQuotes.map((quote, i) => (
                  <blockquote
                    key={i}
                    className="flex items-start gap-2 border-l-2 border-border pl-3 text-sm italic text-muted-foreground"
                  >
                    <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {quote}
                  </blockquote>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
