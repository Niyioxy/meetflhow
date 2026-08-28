"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Phone } from "lucide-react";

export function JoinInAppCallButton({
  scheduledMeetingId,
  size = "default",
}: {
  scheduledMeetingId: string;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    setJoining(true);
    try {
      const res = await fetch(`/api/scheduled-meetings/${scheduledMeetingId}/call-room`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join call");
      router.push(`/call/${data.callRoomId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join call");
      setJoining(false);
    }
  }

  return (
    <Button size={size} onClick={handleJoin} disabled={joining}>
      {joining ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Phone className="mr-2 h-4 w-4" />
      )}
      Join in MeetFlhow
    </Button>
  );
}
