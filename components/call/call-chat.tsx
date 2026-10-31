"use client";

import { useEffect, useRef, useState } from "react";
import type { DailyCall, DailyEventObjectAppMessage } from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

// Daily caps an app message at 4KB; this keeps a message plus its envelope
// well under that.
export const MAX_CHAT_LENGTH = 1000;

export interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  sentAt: number;
  isLocal: boolean;
}

interface ChatPayload {
  type: "chat";
  id: string;
  text: string;
  sentAt: number;
}

function isChatPayload(data: unknown): data is ChatPayload {
  const d = data as Partial<ChatPayload> | null;
  return (
    !!d &&
    d.type === "chat" &&
    typeof d.id === "string" &&
    typeof d.text === "string" &&
    typeof d.sentAt === "number"
  );
}

/**
 * Collects chat messages sent over the call's own Daily connection. Messages
 * are ephemeral: they go peer-to-peer through Daily and aren't stored, so
 * someone joining late sees only what's sent after they arrive.
 */
export function useCallChat(call: DailyCall | null, onIncoming?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const onIncomingRef = useRef(onIncoming);
  onIncomingRef.current = onIncoming;

  useEffect(() => {
    if (!call) return;
    function handle(e?: DailyEventObjectAppMessage) {
      if (!e || !isChatPayload(e.data)) return;
      const payload = e.data;
      const sender = call!.participants()[e.fromId];
      setMessages((prev) =>
        prev.some((m) => m.id === payload.id)
          ? prev
          : [
              ...prev,
              {
                id: payload.id,
                senderName: sender?.user_name || "Someone",
                text: payload.text.slice(0, MAX_CHAT_LENGTH),
                sentAt: payload.sentAt,
                isLocal: false,
              },
            ]
      );
      onIncomingRef.current?.();
    }
    call.on("app-message", handle);
    return () => {
      call.off("app-message", handle);
    };
  }, [call]);

  function send(text: string) {
    const trimmed = text.trim().slice(0, MAX_CHAT_LENGTH);
    if (!call || !trimmed) return;
    const payload: ChatPayload = {
      type: "chat",
      id: crypto.randomUUID(),
      text: trimmed,
      sentAt: Date.now(),
    };
    call.sendAppMessage(payload, "*");
    setMessages((prev) => [
      ...prev,
      { id: payload.id, senderName: "You", text: trimmed, sentAt: payload.sentAt, isLocal: true },
    ]);
  }

  return { messages, send };
}

export function CallChatPanel({
  messages,
  onSend,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-[var(--bg-surface)] p-3">
      <div ref={listRef} className="flex max-h-64 min-h-24 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No messages yet. Chat is visible to everyone currently in the call and isn&apos;t saved.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.isLocal ? "self-end text-right" : "self-start"}>
              <div className="text-[11px] text-muted-foreground">
                {m.senderName} ·{" "}
                {new Date(m.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div
                className={`mt-0.5 inline-block max-w-[16rem] whitespace-pre-wrap break-words rounded-[var(--radius-md)] px-3 py-1.5 text-left text-sm ${
                  m.isLocal ? "bg-[var(--blue-primary)] text-white" : "bg-background"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_CHAT_LENGTH}
          placeholder="Message everyone"
          aria-label="Chat message"
          className="h-9 flex-1 rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--blue-primary)]"
        />
        <Button type="submit" size="sm" disabled={!draft.trim()} aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
