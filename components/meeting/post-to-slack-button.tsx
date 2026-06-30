"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconBrandSlack } from "@tabler/icons-react";

export function PostToSlackButton({ meetingId }: { meetingId: string }) {
  const [posting, setPosting] = useState(false);

  async function handlePost() {
    setPosting(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/post-to-slack`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to post to Slack");
      toast.success(`Posted to #${data.channel ?? "Slack"} ✓`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post to Slack");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handlePost} disabled={posting}>
      {posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <IconBrandSlack className="mr-2 h-4 w-4" />}
      Post to Slack
    </Button>
  );
}
