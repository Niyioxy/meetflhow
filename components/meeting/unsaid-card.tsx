import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MicOff, Zap } from "lucide-react";
import type { UnsaidMetrics } from "@/lib/meeting-dynamics";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function UnsaidCard({ metrics }: { metrics: UnsaidMetrics }) {
  const silencePct = Math.round((metrics.totalSilenceSeconds / metrics.totalDurationSeconds) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>The unsaid</CardTitle>
        <CardDescription>Conversation dynamics — a different lens than tone or airtime.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3">
          <MicOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{formatDuration(metrics.totalSilenceSeconds)} of silence</p>
            <p className="text-xs text-muted-foreground">
              {silencePct}% of the conversation · longest gap {formatDuration(metrics.longestSilenceSeconds)}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">
              {metrics.interruptionCount} interruption{metrics.interruptionCount === 1 ? "" : "s"}
            </p>
            {metrics.interruptionsBySpeaker.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {metrics.interruptionsBySpeaker
                  .map((s) => `Speaker ${s.speaker + 1} (${s.count})`)
                  .join(", ")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No one talked over anyone else.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
