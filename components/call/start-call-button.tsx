"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Loader2, Phone } from "lucide-react";

export function StartCallButton() {
  const router = useRouter();
  const { activeWorkspaceId } = useWorkspace();
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    if (!activeWorkspaceId) {
      toast.error("Select a workspace first to start a call");
      return;
    }
    setStarting(true);
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWorkspaceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start call");
      router.push(`/call/${data.callRoomId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start call");
      setStarting(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleStart} disabled={starting}>
      {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
      Start a call
    </Button>
  );
}
