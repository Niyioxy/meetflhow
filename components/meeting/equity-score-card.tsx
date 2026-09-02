import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { initialsFromName, colorFromName } from "@/lib/avatar";
import type { EquityScore } from "@/lib/meeting-equity";

export function EquityScoreCard({ equity }: { equity: EquityScore }) {
  const { rows, dominated, topSpeaker } = equity;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meeting equity</CardTitle>
        <CardDescription>
          {dominated && topSpeaker
            ? `${topSpeaker.speaker} accounted for ${topSpeaker.share}% of what was said.`
            : "A reasonably balanced conversation — no single speaker dominated."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.speaker} className="flex items-center gap-3">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: colorFromName(row.speaker) }}
            >
              {initialsFromName(row.speaker)}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{row.speaker}</span>
                <span className="text-xs text-muted-foreground">{row.share}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[var(--blue-primary)] transition-[width] duration-300"
                  style={{ width: `${row.share}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
