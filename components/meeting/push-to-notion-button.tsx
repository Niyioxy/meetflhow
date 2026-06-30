"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconBrandNotion } from "@tabler/icons-react";

export function PushToNotionButton({
  meetingId,
  initialPushed,
}: {
  meetingId: string;
  initialPushed: boolean;
}) {
  const [pushing, setPushing] = useState(false);
  const [pushed, setPushed] = useState(initialPushed);

  async function handlePush() {
    setPushing(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/push-to-notion`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to push to Notion");
      setPushed(true);
      toast.success("Added to Notion ✓", {
        action: data.url ? { label: "View Page", onClick: () => window.open(data.url, "_blank") } : undefined,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to push to Notion");
    } finally {
      setPushing(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handlePush} disabled={pushing}>
      {pushing ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <IconBrandNotion className="mr-2 h-4 w-4" />
      )}
      {pushed ? "Update in Notion" : "Push to Notion"}
    </Button>
  );
}
