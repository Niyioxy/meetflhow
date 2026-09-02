import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UploadCloud, Mic, FileText, Sparkles, CheckCircle2, AlertTriangle, RotateCcw } from "lucide-react";
import type { MeetingEventType } from "@/db/schema";
import { cn } from "@/lib/utils";

interface AuditEvent {
  id: string;
  event: MeetingEventType;
  detail: string | null;
  createdAt: string | Date;
}

const EVENT_META: Record<
  MeetingEventType,
  { label: string; icon: typeof UploadCloud; className: string }
> = {
  uploaded: { label: "Uploaded", icon: UploadCloud, className: "text-muted-foreground" },
  transcribing: { label: "Transcription started", icon: Mic, className: "text-muted-foreground" },
  transcribed: { label: "Transcribed", icon: FileText, className: "text-muted-foreground" },
  analyzing: { label: "Analysis started", icon: Sparkles, className: "text-muted-foreground" },
  ready: { label: "Ready", icon: CheckCircle2, className: "text-emerald-600" },
  failed: { label: "Failed", icon: AlertTriangle, className: "text-destructive" },
  retried: { label: "Retried", icon: RotateCcw, className: "text-amber-600" },
};

/**
 * Surfaces the meeting_events audit trail — upload -> transcribe -> analyze
 * runs across several decoupled serverless steps with no other shared log
 * a user can see, so "why did this fail" or "is this still working" used
 * to be a mystery. Chronological, oldest first, reads like the meeting's
 * own story.
 */
export function AuditTrailCard({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing history</CardTitle>
        <CardDescription>What happened to this meeting, step by step.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-3">
          {events.map((event) => {
            const meta = EVENT_META[event.event];
            const Icon = meta.icon;
            return (
              <li key={event.id} className="flex items-start gap-3 text-sm">
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} />
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className={cn("font-medium", meta.className)}>{meta.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.createdAt), "MMM d, h:mm:ss a")}
                    </span>
                  </div>
                  {event.detail && <p className="text-xs text-muted-foreground">{event.detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
