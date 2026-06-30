"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { initialsFromName, colorFromName } from "@/lib/avatar";
import type { SpeakerSegment } from "@/types/analysis";

function highlight(text: string, query: string) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-yellow-200 px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function TranscriptSearch({
  fullText,
  segments,
}: {
  fullText: string | null;
  segments: SpeakerSegment[] | null;
}) {
  const [query, setQuery] = useState("");

  const filteredSegments = useMemo(() => {
    if (!segments) return null;
    if (!query) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(query.toLowerCase()));
  }, [segments, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transcript..."
          className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
        />
      </div>

      {filteredSegments ? (
        <div className="flex max-h-96 flex-col gap-4 overflow-y-auto rounded-md bg-slate-50 p-4">
          {filteredSegments.length === 0 ? (
            <p className="text-sm text-slate-500">No matches found.</p>
          ) : (
            filteredSegments.map((seg, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: colorFromName(seg.speaker) }}
                >
                  {initialsFromName(seg.speaker)}
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{seg.speaker}</span>
                    <span className="text-xs text-slate-400">{seg.timestamp_approx}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">{highlight(seg.text, query)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
          {highlight(fullText ?? "", query)}
        </div>
      )}
    </div>
  );
}
