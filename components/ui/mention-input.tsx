"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { initialsFromName, colorFromName } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { MentionableMember } from "@/types/mentions";

const TEXTAREA_CLASS =
  "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30";

export function MentionInput({
  value,
  onChange,
  placeholder,
  className,
  id,
  workspaceId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  /** Overrides the user's currently-selected workspace — use when the input is scoped to content (e.g. a meeting) that belongs to a specific workspace. */
  workspaceId?: string | null;
}) {
  const { activeWorkspaceId } = useWorkspace();
  const effectiveWorkspaceId = workspaceId !== undefined ? workspaceId : activeWorkspaceId;
  const [members, setMembers] = useState<MentionableMember[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!effectiveWorkspaceId) {
      setMembers([]);
      return;
    }
    fetch(`/api/workspaces/${effectiveWorkspaceId}/members`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const list = (data.members ?? []) as { user_id: string; name: string | null; email: string; image: string | null }[];
        setMembers(list.map((m) => ({ id: m.user_id, name: m.name, email: m.email, image: m.image })));
      })
      .catch(() => setMembers([]));
  }, [effectiveWorkspaceId]);

  const filtered = members
    .filter((m) => (m.name ?? m.email).toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    onChange(newValue);

    const cursor = e.target.selectionStart ?? newValue.length;
    const upToCursor = newValue.slice(0, cursor);
    const atIndex = upToCursor.lastIndexOf("@");

    if (atIndex === -1) {
      setOpen(false);
      return;
    }
    const between = upToCursor.slice(atIndex + 1);
    if (between.includes("\n") || between.length > 40) {
      setOpen(false);
      return;
    }

    setMentionStart(atIndex);
    setQuery(between);
    setHighlighted(0);
    setOpen(members.length > 0);
  }

  function selectMember(member: MentionableMember) {
    if (mentionStart == null || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart ?? value.length;
    const name = member.name ?? member.email;
    const newValue = `${value.slice(0, mentionStart)}@${name} ${value.slice(cursor)}`;
    onChange(newValue);
    setOpen(false);

    requestAnimationFrame(() => {
      const pos = mentionStart + name.length + 2;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectMember(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={cn(TEXTAREA_CLASS, className)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-64 rounded-md border border-border bg-popover p-1 shadow-md">
          {filtered.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selectMember(m);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                i === highlighted ? "bg-muted" : "hover:bg-muted"
              )}
            >
              {m.image ? (
                <img src={m.image} alt="" className="h-6 w-6 shrink-0 rounded-full" />
              ) : (
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: colorFromName(m.name ?? m.email) }}
                >
                  {initialsFromName(m.name ?? m.email)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{m.name ?? m.email}</p>
                {m.name && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
