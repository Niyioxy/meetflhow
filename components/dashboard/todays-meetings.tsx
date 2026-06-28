import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/dashboard/platform-badge";
import { Video } from "lucide-react";

export interface TodaysMeeting {
  id: string;
  title: string;
  platform: string;
  scheduledAt: string;
}

const PLATFORM_SLUGS: Record<string, string> = {
  "Google Meet": "google-meet",
  "Microsoft Teams": "teams",
  Zoom: "zoom",
};

export function TodaysMeetings({ meetings }: { meetings: TodaysMeeting[] }) {
  if (meetings.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-[var(--text-muted)]">
          Today&apos;s meetings
        </h2>
        {meetings.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium tabular-nums">
                {format(new Date(m.scheduledAt), "h:mm a")}
              </span>
              <span className="font-medium">{m.title}</span>
              <PlatformBadge platform={m.platform} />
            </div>
            <Button size="sm" asChild>
              <Link
                href={`/record?title=${encodeURIComponent(m.title)}&platform=${encodeURIComponent(
                  PLATFORM_SLUGS[m.platform] ?? "other"
                )}`}
              >
                <Video className="mr-2 h-4 w-4" />
                Start & Record
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
