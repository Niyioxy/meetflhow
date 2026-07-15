"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare, Check, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initialsFromName, colorFromName } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { CommentThreadPanel } from "@/components/meeting/comment-thread-panel";
import type { SpeakerSegment } from "@/types/analysis";
import type { TranscriptCommentView } from "@/types/comments";

type ViewMode = "speaker" | "full";

// Mirrors CONFIDENT_THRESHOLD in lib/voice-identification.ts — kept as a
// plain constant here (not imported) since that module pulls in server-only
// DB/ffmpeg code that must not reach the client bundle.
const CONFIDENT_THRESHOLD = 0.65;

export function TranscriptCard({
  meetingId,
  fullText,
  wordCount,
  language,
  initialSegments,
  workspaceId = null,
  candidateNames = [],
}: {
  meetingId: string;
  fullText: string;
  wordCount: number;
  language: string | null;
  initialSegments: SpeakerSegment[] | null;
  workspaceId?: string | null;
  candidateNames?: string[];
}) {
  const [segments, setSegments] = useState(initialSegments);
  const [loadingSegments, setLoadingSegments] = useState(!initialSegments);
  const [mode, setMode] = useState<ViewMode>("full");
  const [comments, setComments] = useState<TranscriptCommentView[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [focusSegmentIndex, setFocusSegmentIndex] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/meetings/${meetingId}/comments`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setComments([]));
  }, [meetingId]);

  function commentsFor(segmentIndex: number) {
    return comments.filter((c) => c.segment_index === segmentIndex);
  }

  function openSegmentThread(segmentIndex: number) {
    setFocusSegmentIndex(segmentIndex);
    setPanelOpen(true);
  }

  async function refreshComments() {
    const res = await fetch(`/api/meetings/${meetingId}/comments`);
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments ?? []);
    }
  }

  async function handleCreateComment(segmentIndex: number, text: string) {
    const seg = segments?.[segmentIndex];
    try {
      const res = await fetch(`/api/meetings/${meetingId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment_index: segmentIndex,
          selected_text: seg?.text ?? "",
          comment: text,
        }),
      });
      if (!res.ok) throw new Error();
      await refreshComments();
    } catch {
      toast.error("Failed to add comment");
    }
  }

  async function handleReply(commentId: string, text: string) {
    try {
      const res = await fetch(`/api/comments/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: text }),
      });
      if (!res.ok) throw new Error();
      await refreshComments();
    } catch {
      toast.error("Failed to add reply");
    }
  }

  async function handleToggleResolve(commentId: string) {
    try {
      const res = await fetch(`/api/comments/${commentId}/resolve`, { method: "POST" });
      if (!res.ok) throw new Error();
      await refreshComments();
    } catch {
      toast.error("Failed to update comment");
    }
  }

  async function handleReassignSpeaker(oldSpeaker: string, newName: string) {
    if (!newName.trim() || newName === oldSpeaker) return;
    try {
      const res = await fetch(`/api/meetings/${meetingId}/speaker-name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldSpeaker, newName }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSegments(data.speakerSegments);
    } catch {
      toast.error("Failed to reassign speaker");
    }
  }

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
        <CardTitle>Transcript{comments.length > 0 ? ` (${comments.length})` : ""}</CardTitle>
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
            {segments!.map((seg, i) => {
              const segComments = commentsFor(i);
              return (
                <div
                  key={i}
                  className={cn(
                    "group/segment flex gap-3 rounded-md border-l-2 px-2 py-1 -mx-2",
                    segComments.length > 0 ? "border-l-[var(--blue-primary)]" : "border-l-transparent"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                      seg.identificationMethod !== "voice_match" &&
                        seg.identificationMethod !== "manual" &&
                        "border-2 border-dashed border-white/60"
                    )}
                    style={{ backgroundColor: colorFromName(seg.speaker) }}
                  >
                    {initialsFromName(seg.speaker)}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="text-sm font-bold hover:underline">
                            {seg.speaker}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {candidateNames
                            .filter((name) => name !== seg.speaker)
                            .map((name) => (
                              <DropdownMenuItem
                                key={name}
                                onClick={() => handleReassignSpeaker(seg.speaker, name)}
                              >
                                {name}
                              </DropdownMenuItem>
                            ))}
                          <DropdownMenuItem
                            onClick={() => {
                              const name = window.prompt("Speaker name", seg.speaker);
                              if (name) handleReassignSpeaker(seg.speaker, name);
                            }}
                          >
                            Other...
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {seg.identificationMethod === "voice_match" &&
                      (seg.confidence ?? 0) > CONFIDENT_THRESHOLD ? (
                        <span title="Identified by voice">
                          <Check className="h-3.5 w-3.5 text-[#10B981]" />
                        </span>
                      ) : seg.identificationMethod !== "manual" ? (
                        <span
                          title={
                            seg.identificationMethod === "voice_match"
                              ? "Possible voice match — click name to confirm"
                              : "AI guess — click name to correct"
                          }
                        >
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">{seg.timestamp_approx}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{seg.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSegmentThread(i)}
                    className={cn(
                      "flex shrink-0 items-center gap-1 self-start rounded-full px-1.5 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/segment:opacity-100",
                      segComments.length > 0 && "opacity-100"
                    )}
                    title="Comment on this"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {segComments.length > 0 && <span>{segComments.length}</span>}
                  </button>
                </div>
              );
            })}
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

      <CommentThreadPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        comments={comments}
        focusSegmentIndex={focusSegmentIndex}
        workspaceId={workspaceId}
        onCreateComment={handleCreateComment}
        onReply={handleReply}
        onToggleResolve={handleToggleResolve}
      />
    </Card>
  );
}
