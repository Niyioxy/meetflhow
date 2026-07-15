"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function storageKey(userId: string) {
  return `meetflow_voice_nudge_dismissed_${userId}`;
}

export function VoiceProfileBanner({ userId }: { userId: string }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(storageKey(userId)) === "true");
  }, [userId]);

  if (dismissed) return null;

  return (
    <Card className="border-[rgba(37,99,235,0.3)] bg-[rgba(37,99,235,0.08)]">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          <Mic className="h-5 w-5 shrink-0 text-[var(--blue-primary,#2563EB)]" />
          <p className="text-sm font-medium">
            Set up your voice profile so MeetFlhow can identify you in meetings automatically.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" asChild>
            <Link href="/onboarding/voice">Set up now</Link>
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              localStorage.setItem(storageKey(userId), "true");
              setDismissed(true);
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
