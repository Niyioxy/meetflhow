"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MentionInput } from "@/components/ui/mention-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TranscriptCommentView } from "@/types/comments";

type Filter = "all" | "open" | "resolved";

function CommentAuthor({ name, image }: { name: string | null; image: string | null }) {
  return (
    <Avatar className="h-6 w-6">
      <AvatarImage src={image ?? undefined} alt={name ?? ""} />
      <AvatarFallback className="text-[10px]">{(name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

export function CommentThreadPanel({
  open,
  onOpenChange,
  comments,
  focusSegmentIndex,
  workspaceId,
  onCreateComment,
  onReply,
  onToggleResolve,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comments: TranscriptCommentView[];
  focusSegmentIndex: number | null;
  workspaceId: string | null;
  onCreateComment: (segmentIndex: number, text: string) => Promise<void>;
  onReply: (commentId: string, text: string) => Promise<void>;
  onToggleResolve: (commentId: string) => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [composerText, setComposerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  const scoped = focusSegmentIndex != null ? comments.filter((c) => c.segment_index === focusSegmentIndex) : comments;
  const filtered = scoped.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  async function handleSubmitComposer() {
    if (focusSegmentIndex == null || !composerText.trim()) return;
    setSubmitting(true);
    try {
      await onCreateComment(focusSegmentIndex, composerText.trim());
      setComposerText("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitReply(commentId: string) {
    const text = replyDrafts[commentId]?.trim();
    if (!text) return;
    await onReply(commentId, text);
    setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-80 flex-col border-l border-border bg-[var(--bg-surface)] shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Comments</h3>
        <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        {(["all", "open", "resolved"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
              filter === f
                ? "bg-[var(--bg-card)] text-[var(--blue-glow)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
            )}
          >
            {f === "all" ? "All comments" : f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {focusSegmentIndex != null && (
          <div className="mb-4 flex flex-col gap-2 border-b border-border pb-4">
            <MentionInput
              placeholder="Add a comment..."
              value={composerText}
              onChange={setComposerText}
              workspaceId={workspaceId}
              className="min-h-20 text-sm"
            />
            <Button size="sm" onClick={handleSubmitComposer} disabled={submitting || !composerText.trim()}>
              Comment
            </Button>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {filtered.map((c) => (
              <div key={c.id} className={cn("flex flex-col gap-2", c.resolved && "opacity-50")}>
                <div className="flex items-start gap-2">
                  <CommentAuthor name={c.user_name} image={c.user_image} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{c.user_name ?? "Someone"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed">{c.comment}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title={c.resolved ? "Re-open" : "Resolve"}
                    onClick={() => onToggleResolve(c.id)}
                  >
                    <Check className={cn("h-3.5 w-3.5", c.resolved && "text-[var(--blue-glow)]")} />
                  </Button>
                </div>

                {c.replies.length > 0 && (
                  <div className="ml-8 flex flex-col gap-2 border-l border-border pl-3">
                    {c.replies.map((r) => (
                      <div key={r.id} className="flex items-start gap-2">
                        <CommentAuthor name={r.user_name} image={r.user_image} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{r.user_name ?? "Someone"}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm leading-relaxed">{r.reply}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="ml-8 flex items-center gap-2">
                  <input
                    value={replyDrafts[c.id] ?? ""}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmitReply(c.id)}
                    placeholder="Reply..."
                    className="flex-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none focus:border-[var(--blue-primary)]"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
