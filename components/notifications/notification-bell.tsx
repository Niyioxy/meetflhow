"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MentionView } from "@/types/mentions";

const CONTEXT_LABEL: Record<string, string> = {
  action_item: "an action item",
  comment: "a comment",
  task: "a task",
  todo: "a todo",
};

export function NotificationBell() {
  const router = useRouter();
  const [mentions, setMentions] = useState<MentionView[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/mentions");
      if (!res.ok) return;
      const data = await res.json();
      setMentions(data.mentions ?? []);
    } catch {
      // silently ignore — notification fetch failures shouldn't disrupt the rest of the UI
    }
  }

  useEffect(() => {
    load();
  }, []);

  const unreadCount = mentions.filter((m) => !m.read).length;

  async function handleMarkAllRead() {
    setMentions((prev) => prev.map((m) => ({ ...m, read: true })));
    await fetch("/api/mentions/read-all", { method: "POST" });
  }

  async function handleClick(mention: MentionView) {
    if (!mention.read) {
      setMentions((prev) => prev.map((m) => (m.id === mention.id ? { ...m, read: true } : m)));
      fetch(`/api/mentions/${mention.id}/read`, { method: "POST" });
    }
    setOpen(false);
    if (mention.meeting_id) {
      router.push(`/meetings/${mention.meeting_id}`);
    }
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <DropdownMenuTrigger asChild>
        <button type="button" className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--bg-card)]">
          <Bell className="h-[18px] w-[18px] text-[var(--text-secondary)]" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--blue-primary)] px-1 text-[9px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {mentions.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No mentions yet.</p>
        ) : (
          mentions.map((m) => (
            <DropdownMenuItem
              key={m.id}
              onClick={() => handleClick(m)}
              className="flex items-start gap-2 whitespace-normal py-2"
            >
              {!m.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--blue-primary)]" />}
              <div className={cn("min-w-0 flex-1", m.read && "ml-3.5")}>
                <p className="text-sm">
                  <span className="font-medium">{m.from_user_name ?? "Someone"}</span> mentioned you in{" "}
                  {CONTEXT_LABEL[m.context_type] ?? "MeetFlhow"}
                  {m.meeting_title ? ` · ${m.meeting_title}` : ""}
                </p>
                {m.context_text && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.context_text}</p>
                )}
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                </p>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
