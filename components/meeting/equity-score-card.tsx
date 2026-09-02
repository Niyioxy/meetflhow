import { HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { initialsFromName, colorFromName } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import type { EquityScore } from "@/lib/meeting-equity";

/**
 * The speaker-naming pipeline (lib/gemini/speakers.ts) falls back to bare
 * "Unknown" or "Unknown Speaker N" labels when it can't place a voice —
 * common for single-mic recordings or heavy audio overlap where Deepgram
 * never produced clean diarization to begin with. Equity Score just
 * surfaces whatever labels exist, so it needs to render those
 * unidentified-but-real speakers as clearly distinct from a named person
 * rather than showing a confusing bare "Unknown".
 */
function isUnidentified(speaker: string): boolean {
  return /^unknown(\s+speaker\s+\d+)?$/i.test(speaker.trim());
}

function displayName(speaker: string): string {
  const trimmed = speaker.trim();
  if (/^unknown$/i.test(trimmed)) return "Unidentified speaker";
  const match = trimmed.match(/^unknown\s+speaker\s+(\d+)$/i);
  return match ? `Unidentified speaker ${match[1]}` : speaker;
}

export function EquityScoreCard({ equity }: { equity: EquityScore }) {
  const { rows, dominated, topSpeaker } = equity;
  const hasUnidentified = rows.some((row) => isUnidentified(row.speaker));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meeting equity</CardTitle>
        <CardDescription>
          {dominated && topSpeaker
            ? `${displayName(topSpeaker.speaker)} accounted for ${topSpeaker.share}% of what was said.`
            : "A reasonably balanced conversation — no single speaker dominated."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((row) => {
          const unidentified = isUnidentified(row.speaker);
          return (
            <div key={row.speaker} className="flex items-center gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: unidentified ? "#6B7280" : colorFromName(row.speaker) }}
              >
                {unidentified ? (
                  <HelpCircle className="h-3.5 w-3.5" />
                ) : (
                  initialsFromName(row.speaker)
                )}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className={cn("font-medium", unidentified && "italic text-muted-foreground")}>
                    {displayName(row.speaker)}
                  </span>
                  <span className="text-xs text-muted-foreground">{row.share}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      unidentified ? "bg-muted-foreground/40" : "bg-[var(--blue-primary)]"
                    )}
                    style={{ width: `${row.share}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {hasUnidentified && (
          <p className="mt-1 text-xs text-muted-foreground">
            Some voices couldn&apos;t be confidently separated in this recording — common with
            single-mic setups or heavy audio overlap.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
