"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { MeetingStatus } from "@/db/schema";

const LABEL: Record<MeetingStatus, string> = {
  uploading: "Uploading your recording...",
  transcribing: "Transcribing audio with Deepgram...",
  analyzing: "Analyzing transcript with Gemini...",
  ready: "Ready",
  failed: "Failed",
};

export function ProcessingBanner({
  meetingId,
  status,
}: {
  meetingId: string;
  status: MeetingStatus;
}) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/meetings/${meetingId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.meeting && data.meeting.status !== status) {
        router.refresh();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [meetingId, status, router]);

  return (
    <Card className="border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.08)]">
      <CardContent className="flex items-center gap-3 py-6">
        <Loader2 className="h-5 w-5 animate-spin text-[#FCD34D]" />
        <p className="font-medium text-[#FCD34D]">{LABEL[status]}</p>
      </CardContent>
    </Card>
  );
}
