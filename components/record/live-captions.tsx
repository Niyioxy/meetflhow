"use client";

import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { useLiveCaptions } from "@/hooks/use-live-captions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { locales, localeNames, type Locale } from "@/i18n/config";

type CaptionMode = "off" | "original" | Locale;

export function LiveCaptions({
  stream,
  active,
}: {
  stream: MediaStream | null;
  active: boolean;
}) {
  const { status, lines, setTargetLanguage, start, stop } = useLiveCaptions();
  const [mode, setMode] = useState<CaptionMode>("off");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || mode === "off" || !stream) {
      if (status !== "idle") stop();
      return;
    }
    if (status === "idle") {
      start(stream);
    }
  }, [active, mode, stream, status, start, stop]);

  useEffect(() => {
    setTargetLanguage(mode !== "off" && mode !== "original" ? mode : null);
  }, [mode, setTargetLanguage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  if (!active) return null;

  return (
    <div className="flex w-full flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-[var(--bg-surface)] p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Live captions</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Globe className="mr-2 h-3.5 w-3.5" />
              {mode === "off" ? "Off" : mode === "original" ? "Original" : localeNames[mode]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setMode("off")}>Off</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setMode("original")}>Original</DropdownMenuItem>
            {locales.map((l) => (
              <DropdownMenuItem key={l} onSelect={() => setMode(l)}>
                {localeNames[l]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {mode !== "off" && (
        <div ref={scrollRef} className="flex max-h-40 flex-col gap-1.5 overflow-y-auto text-sm">
          {status === "connecting" && (
            <p className="text-xs text-muted-foreground">Connecting…</p>
          )}
          {status === "error" && (
            <p className="text-xs text-destructive">Live captions failed to connect.</p>
          )}
          {lines.length === 0 && status === "live" && (
            <p className="text-xs text-muted-foreground">Listening…</p>
          )}
          {lines.map((line) => (
            <p key={line.id} className="leading-snug">
              {line.translated ?? (line.translating ? `${line.original} …` : line.original)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
