"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Radar } from "lucide-react";
import { useLiveCaptions } from "@/hooks/use-live-captions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { detectSignals, type DealSignalCategory } from "@/lib/deal-radar";
import { cn } from "@/lib/utils";

type CaptionMode = "off" | "original" | Locale;

interface FlaggedSignal {
  key: string;
  phrase: string;
  category: DealSignalCategory;
}

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

  // Live Deal Radar — client-side keyword watch over the same caption
  // stream, no new AI calls. Runs whenever captions are on, independent of
  // which language they're displayed in (always scans the original text).
  const [signals, setSignals] = useState<FlaggedSignal[]>([]);
  const recordedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const line of lines) {
      for (const signal of detectSignals(line.original)) {
        const key = `${line.id}:${signal.phrase}`;
        if (recordedKeysRef.current.has(key)) continue;
        recordedKeysRef.current.add(key);
        setSignals((prev) => [...prev, { key, phrase: signal.phrase, category: signal.category }]);
      }
    }
  }, [lines]);

  useEffect(() => {
    if (!active) {
      setSignals([]);
      recordedKeysRef.current.clear();
    }
  }, [active]);

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

      {signals.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Radar className="h-3 w-3" />
            Deal radar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {signals.map((signal) => (
              <span
                key={signal.key}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  signal.category === "risk"
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-emerald-500/15 text-emerald-600"
                )}
              >
                {signal.phrase}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
